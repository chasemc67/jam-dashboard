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
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
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

const run = promisify(execFile);
let mainWindow;
let openingAnalyzer;

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

async function openAnalyzer() {
  if (openingAnalyzer) return openingAnalyzer;
  openingAnalyzer = (async () => {
    const analyzer = path.join(
      app.isPackaged
        ? process.resourcesPath
        : path.join(__dirname, 'native', 'dist'),
      'YouTube Music Analyzer.app',
    );
    try {
      await stat(analyzer);
      // Fixed bundled path, no shell or renderer-supplied arguments.
      await run('/usr/bin/open', ['-a', analyzer], { timeout: 10000 });
      return { ok: true };
    } catch (error) {
      console.error('Analyzer launch failed:', error);
      return {
        ok: false,
        error:
          'The bundled analyzer could not be opened. Reinstall Jam Dashboard, or run npm run desktop:build in a development checkout.',
      };
    }
  })();
  try {
    return await openingAnalyzer;
  } finally {
    openingAnalyzer = undefined;
  }
}

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
      ipcMain.handle('jam:open-analyzer', event => {
        if (
          event.sender !== mainWindow?.webContents ||
          event.senderFrame !== mainWindow.webContents.mainFrame ||
          !isAppURL(event.senderFrame.url)
        )
          throw new Error('Untrusted analyzer request');
        return openAnalyzer();
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
                click: async () => {
                  const result = await openAnalyzer();
                  if (!result.ok)
                    dialog.showErrorBox(
                      'Could not open the analyzer',
                      result.error,
                    );
                },
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
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
