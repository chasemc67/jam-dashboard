const {
  app,
  BrowserWindow,
  clipboard,
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
const {
  startAgentService,
  loadAgentToken,
  createDesktopAgentApi,
  createGatewayKeyManager,
  createKeychainStore,
  isDesktopAgentApiURL,
  runSecurityCommand,
  SECURITY_PATH,
} = require('./agent-service.cjs');
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
const {
  appBundlePath,
  createLogger,
  createUpdater,
  isDeveloperIdSigned,
  readCodeSignature,
} = require('./updater.cjs');

let mainWindow;
let analyzer;
let agentService;
let agentConnection;
let agentSession;
let updater;
let updaterLog;
// Each user's own Vercel AI Gateway key lives in their macOS Keychain, never in the app bundle.
// JAM_DESKTOP_SECURITY_BIN swaps in a stand-in `security` tool for unpackaged test runs only.
const gatewayKey = createGatewayKeyManager({
  keychain: createKeychainStore({
    run: runSecurityCommand(
      (!app.isPackaged && process.env.JAM_DESKTOP_SECURITY_BIN) ||
        SECURITY_PATH,
    ),
  }),
  env: process.env,
  preferEnvironment: !app.isPackaged,
});
const agentApi = createDesktopAgentApi({
  getGatewayKey: async () => (await gatewayKey.resolve()).key,
  getMcpConnection: () => agentConnection?.connection,
});
function detachAgent() {
  if (agentSession) agentService?.registry.detach(agentSession);
  agentSession = undefined;
}

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
    detachAgent();
    mainWindow = undefined;
  });
  mainWindow.webContents.on('render-process-gone', detachAgent);
  mainWindow.webContents.on(
    'did-start-navigation',
    (_event, _url, inPlace, isMainFrame) => {
      if (isMainFrame && !inPlace) detachAgent();
    },
  );
  await mainWindow.loadURL(APP_URL);
}

async function startUpdater() {
  updaterLog = createLogger(path.join(app.getPath('logs'), 'updater.log'));
  if (!app.isPackaged) {
    updaterLog.info('Skipping updates in an unpackaged development build');
    return;
  }
  const signature = await readCodeSignature(appBundlePath(process.execPath));
  const { autoUpdater } = require('./electron-updater.cjs');
  updater = createUpdater({
    autoUpdater,
    dialog,
    shell,
    getWindow: () => mainWindow,
    currentVersion: app.getVersion(),
    canSelfUpdate: isDeveloperIdSigned(signature),
    log: updaterLog,
  });
  updater.start();
}

function checkForUpdates() {
  if (updater) {
    updater
      .check({ interactive: true })
      .catch(error => updaterLog.error(error));
    return;
  }
  const options = {
    type: 'info',
    message: 'Updates are unavailable in this build',
    detail: app.isPackaged
      ? 'The updater could not start. See ~/Library/Logs/Jam Dashboard/updater.log.'
      : 'Update checks run only in the packaged app.',
  };
  (mainWindow
    ? dialog.showMessageBox(mainWindow, options)
    : dialog.showMessageBox(options)
  ).catch(console.error);
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
        if (isDesktopAgentApiURL(request.url)) {
          try {
            return await agentApi(request);
          } catch (error) {
            console.error('Agent API request failed:', error);
            return Response.json(
              { error: 'The chat agent failed. Try again.' },
              { status: 500 },
            );
          }
        }
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
            throw new Error('Untrusted app request');
          }
          try {
            const result = await handler(...args);
            return raw ? result : { ok: true };
          } catch (error) {
            if (raw) throw error;
            return { ok: false, error: error.message };
          }
        });
      try {
        const token = await loadAgentToken(
          path.join(app.getPath('userData'), 'agent-token'),
        );
        agentService = await startAgentService({
          token,
          songAnalyzer: {
            startSongAnalysis: query => {
              const result = analyzer.startSongAnalysis(query);
              const contents = mainWindow?.webContents;
              if (contents && !contents.isDestroyed())
                contents.send('jam:analyzer-open');
              return result;
            },
            getSongAnalysis: jobId => analyzer.getSongAnalysis(jobId),
            cancelSongAnalysis: jobId => analyzer.cancelSongAnalysis(jobId),
          },
        });
        agentConnection = { connection: { url: agentService.url, token } };
      } catch (error) {
        agentConnection = {
          error: `MCP service could not start: ${error.message}. Close any other service using port 4177 and restart Jam Dashboard.`,
        };
      }
      handle('jam:agent-connection', () => agentConnection, true);
      handle('jam:gateway-key-status', () => gatewayKey.status(), true);
      handle('jam:gateway-key-save', key => gatewayKey.save(key), true);
      handle('jam:gateway-key-clear', () => gatewayKey.clear(), true);
      handle(
        'jam:agent-copy-config',
        () => {
          const connection = agentConnection.connection;
          if (!connection) throw new Error('Agent service unavailable.');
          clipboard.writeText(
            JSON.stringify(
              {
                mcpServers: {
                  'jam-dashboard': {
                    url: connection.url,
                    headers: { Authorization: `Bearer ${connection.token}` },
                  },
                },
              },
              null,
              2,
            ),
          );
        },
        true,
      );
      handle(
        'jam:agent-connect',
        state => {
          if (!agentService) throw new Error(agentConnection.error);
          detachAgent();
          agentSession = agentService.registry.attach(
            'desktop',
            state,
            request => {
              if (!mainWindow || mainWindow.webContents.isDestroyed())
                throw new Error('Dashboard window closed.');
              mainWindow.webContents.send('jam:agent-command', request);
            },
          );
          return agentSession;
        },
        true,
      );
      handle(
        'jam:agent-disconnect',
        id => {
          if (id === agentSession) detachAgent();
        },
        true,
      );
      handle(
        'jam:agent-state',
        (id, state) => {
          if (id === agentSession) agentService.registry.update(id, state);
        },
        true,
      );
      handle(
        'jam:agent-reply',
        (id, reply) => {
          if (id === agentSession) agentService.registry.reply(id, reply);
        },
        true,
      );
      handle('jam:analyzer-state', () => analyzer.getState(), true);
      handle('jam:analyzer-youtube', input => analyzer.startYouTube(input));
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
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { label: 'Check for Updates…', click: checkForUpdates },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
          { role: 'editMenu' },
          { role: 'viewMenu' },
          { role: 'windowMenu' },
        ]),
      );
      await createWindow();
      app.on('activate', () => {
        if (!BrowserWindow.getAllWindows().length)
          createWindow().catch(console.error);
      });
      startUpdater().catch(error =>
        (updaterLog ?? console).error('Updater could not start:', error),
      );
    })
    .catch(error => {
      dialog.showErrorBox('Jam Dashboard could not start', error.message);
      app.quit();
    });
  // Standard macOS behavior: keep the app available from the Dock after closing a window.
  app.on('before-quit', () => {
    analyzer?.stop();
    void agentService?.close().catch(console.error);
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
