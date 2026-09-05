const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  shell,
  systemPreferences,
} = require('electron');
const { AnalyzerService, AUDIO_EXTENSIONS } = require('./analyzer.cjs');
const { readFile, stat } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  APP_URL,
  isAppURL,
  isExternalURL,
  assetPath,
  contentSecurityPolicy,
} = require('./policy.cjs');

let mainWindow;
let analyzer;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'jam',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

function openExternal(url) {
  if (isExternalURL(url)) shell.openExternal(url).catch(console.error);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 800,
    minHeight: 600,
    title: 'Jam Dashboard',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppURL(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });
  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isAppURL(url)) event.preventDefault();
  });
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
  await mainWindow.loadURL(APP_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      const root = path.join(__dirname, 'renderer', 'client');
      const csp = contentSecurityPolicy(
        await readFile(path.join(root, 'index.html'), 'utf8'),
      );
      await protocol.handle('jam', async request => {
        const file = assetPath(request.url, root);
        if (!file || !['GET', 'HEAD'].includes(request.method))
          return new Response('Not found', { status: 404 });
        try {
          if (!(await stat(file)).isFile())
            return new Response('Not found', { status: 404 });
          const response = await net.fetch(pathToFileURL(file).href);
          response.headers.set('Content-Security-Policy', csp);
          return response;
        } catch {
          return new Response('Not found', { status: 404 });
        }
      });

      const trusted = (contents, origin) =>
        contents === mainWindow?.webContents && isAppURL(origin);
      session.defaultSession.setPermissionCheckHandler(
        (contents, permission, origin, details) =>
          trusted(contents, origin) &&
          permission === 'media' &&
          details.mediaType === 'audio',
      );
      session.defaultSession.setPermissionRequestHandler(
        async (contents, permission, callback, details) => {
          if (
            !trusted(contents, details.requestingUrl) ||
            permission !== 'media' ||
            !details.mediaTypes?.length ||
            details.mediaTypes.some(type => type !== 'audio')
          ) {
            callback(false);
            return;
          }
          try {
            callback(await systemPreferences.askForMediaAccess('microphone'));
          } catch {
            callback(false);
          }
        },
      );
      analyzer = new AnalyzerService({
        helperPath: path.join(
          app.isPackaged
            ? process.resourcesPath
            : path.join(__dirname, 'native', 'dist'),
          'MusicAnalyzerCLI',
        ),
        destination: app.getPath('desktop'),
        onChange: state => {
          const contents = mainWindow?.webContents;
          if (contents && !contents.isDestroyed())
            contents.send('jam:analyzer-changed', state);
        },
      });
      const handle = (channel, handler, raw = false) =>
        ipcMain.handle(channel, async (event, ...args) => {
          if (
            event.sender !== mainWindow?.webContents ||
            event.senderFrame !== mainWindow.webContents.mainFrame ||
            !isAppURL(event.senderFrame.url)
          ) {
            throw new Error('Untrusted analyzer request');
          }
          try {
            const result = await handler(...args);
            return raw ? result : { ok: true };
          } catch (error) {
            if (raw) throw error;
            return { ok: false, error: error.message };
          }
        });
      handle('jam:analyzer-state', () => analyzer.getState(), true);
      handle('jam:analyzer-youtube', url => analyzer.startYouTube(url));
      handle('jam:analyzer-local', file => analyzer.startFile(file));
      handle('jam:analyzer-cancel', () => analyzer.stop());
      handle('jam:analyzer-destination', async () => {
        analyzer.ensureIdle();
        const result = await dialog.showOpenDialog(mainWindow, {
          title: 'Save downloaded MP3s to',
          defaultPath: analyzer.state.destination,
          properties: ['openDirectory', 'createDirectory'],
        });
        if (!result.canceled) analyzer.setDestination(result.filePaths[0]);
      });
      handle('jam:analyzer-choose-audio', async () => {
        analyzer.ensureIdle();
        const result = await dialog.showOpenDialog(mainWindow, {
          title: 'Analyze an audio file',
          properties: ['openFile'],
          filters: [{ name: 'Audio', extensions: AUDIO_EXTENSIONS }],
        });
        if (!result.canceled) analyzer.startFile(result.filePaths[0]);
      });
      handle('jam:analyzer-reveal', async () => {
        const file = analyzer.state.file;
        if (!file || !(await stat(file.path)).isFile())
          throw new Error('The audio file could not be found.');
        shell.showItemInFolder(file.path);
      });
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          { role: 'appMenu' },
          { role: 'editMenu' },
          { role: 'viewMenu' },
          {
            label: 'Tools',
            submenu: [
              {
                label: 'YouTube Music Analyzer',
                click: () => mainWindow?.webContents.send('jam:show-analyzer'),
              },
            ],
          },
          { role: 'windowMenu' },
        ]),
      );
      await createWindow();
      app.on('activate', () => {
        if (!BrowserWindow.getAllWindows().length)
          createWindow().catch(console.error);
      });
    })
    .catch(error => {
      dialog.showErrorBox('Jam Dashboard could not start', error.message);
      app.quit();
    });
  // Standard macOS behavior: keep the app available from the Dock after closing a window.
  app.on('before-quit', () => analyzer?.stop());
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
