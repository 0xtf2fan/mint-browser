const { app, BrowserWindow, WebContentsView, ipcMain, session, Menu } = require('electron');
const path = require('node:path');
const { resolveAddress, isWebURL } = require('./address.cjs');
const { isNavigationURL } = require('./navigation.cjs');

const TOP = 132;
const HOME = 'mint://newtab';
let win, browsing, activeId, nextId = 1;
const tabs = new Map();
let mounted = null;
let clearing = false;

function active() { return tabs.get(activeId); }
function publish() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('browser:state', {
    activeId,
    clearing,
    tabs: [...tabs.values()].map(t => ({
      id: t.id, title: t.title, url: t.url, loading: t.loading, error: t.error,
      back: t.view && !t.view.webContents.isDestroyed() ? t.view.webContents.navigationHistory.canGoBack() : false,
      forward: t.view && !t.view.webContents.isDestroyed() ? t.view.webContents.navigationHistory.canGoForward() : false
    }))
  });
}

function layout() {
  if (!win || win.isDestroyed()) return;
  if (mounted) { win.contentView.removeChildView(mounted); mounted = null; }
  const tab = active();
  if (tab?.view && tab.url !== HOME) {
    const [width, height] = win.getContentSize();
    tab.view.setBounds({ x: 0, y: TOP, width, height: Math.max(0, height - TOP) });
    win.contentView.addChildView(tab.view);
    mounted = tab.view;
  }
}

function activate(id) {
  if (!tabs.has(id)) return;
  activeId = id;
  layout(); publish();
  if (active()?.view && active().url !== HOME) active().view.webContents.focus();
}

function createTab(input = HOME) {
  const id = nextId++;
  tabs.set(id, { id, title: 'New tab', url: HOME, loading: false, error: '', view: null });
  activate(id);
  if (input !== HOME) navigate(input);
  return id;
}

function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab) return;
  if (tab.view && tab.view === mounted) { win.contentView.removeChildView(mounted); mounted = null; }
  const ids = [...tabs.keys()];
  const index = ids.indexOf(id);
  tabs.delete(id);
  tab.view?.webContents.close();
  if (!tabs.size) createTab();
  else if (activeId === id) activate(ids[index + 1] || ids[index - 1]);
  else publish();
}

function installKeys(contents) {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    const control = input.control || input.meta;
    const actions = {
      l: () => { win.webContents.focus(); win.webContents.send('browser:focus-address'); },
      t: () => createTab(), w: () => closeTab(activeId), r: () => active()?.view?.webContents.reload(),
      tab: () => { const ids = [...tabs.keys()]; activate(ids[(ids.indexOf(activeId) + (input.shift ? ids.length - 1 : 1)) % ids.length]); }
    };
    if (control && actions[key]) { event.preventDefault(); actions[key](); }
    else if (key === 'f5') { event.preventDefault(); active()?.view?.webContents.reload(); }
    else if (input.alt && ['arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault(); history(key === 'arrowleft' ? 'back' : 'forward');
    }
  });
}

function makeView(tab) {
  const view = new WebContentsView({ webPreferences: {
    session: browsing, nodeIntegration: false, contextIsolation: true,
    sandbox: true, webSecurity: true, allowRunningInsecureContent: false
  }});
  const wc = view.webContents;
  wc.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
  tab.view = view;
  // Ordinary Chromium UA avoids sites treating the browser as an embedded app.
  wc.setUserAgent(wc.getUserAgent().replace(/\s(?:Electron|mint-browser)\/\S+/g, ''));
  wc.setWindowOpenHandler(({ url }) => {
    if (isWebURL(url)) createTab(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    if (!isNavigationURL(event.url || url, true)) event.preventDefault();
  });
  wc.on('will-redirect', (event, url, _inPlace, isMainFrame) => {
    if (!isNavigationURL(event.url || url, event.isMainFrame ?? isMainFrame ?? true)) event.preventDefault();
  });
  wc.on('will-frame-navigate', event => {
    if (!isNavigationURL(event.url, event.isMainFrame)) event.preventDefault();
  });
  const updateURL = (_event, url) => { tab.url = url; tab.error = ''; publish(); };
  wc.on('did-navigate', updateURL);
  wc.on('did-navigate-in-page', (event, url, isMainFrame) => {
    if (isMainFrame) updateURL(event, url);
  });
  wc.on('page-title-updated', (_event, title) => { tab.title = title.slice(0, 160); publish(); });
  wc.on('did-start-loading', () => { tab.loading = true; publish(); });
  wc.on('did-stop-loading', () => { tab.loading = false; publish(); });
  wc.on('did-fail-load', (_e, code, _description, _url, mainFrame) => {
    if (!mainFrame || code === -3) return;
    tab.error = 'This page could not be loaded. Check the address or your connection.';
    tab.loading = false; publish();
  });
  wc.on('render-process-gone', () => { tab.error = 'This tab stopped responding. Reload to continue.'; publish(); });
  installKeys(wc);
  return view;
}

function navigate(input) {
  const tab = active();
  if (!tab) return;
  let url;
  try { url = resolveAddress(input); }
  catch (error) { win.webContents.send('browser:notice', error.message); return; }
  tab.url = url; tab.error = '';
  if (url === HOME) {
    tab.view?.webContents.stop();
    if (tab.view && tab.view === mounted) { win.contentView.removeChildView(mounted); mounted = null; }
    tab.view?.webContents.close(); tab.view = null;
    tab.title = 'New tab'; tab.loading = false;
  } else {
    if (!tab.view) makeView(tab);
    tab.title = new URL(url).hostname;
    tab.view.webContents.loadURL(url).catch(() => {});
  }
  layout(); publish();
}

function history(direction) {
  const h = active()?.view?.webContents.navigationHistory;
  if (direction === 'back' && h?.canGoBack()) h.goBack();
  if (direction === 'forward' && h?.canGoForward()) h.goForward();
}

async function command(event, action, value) {
  if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) return;
  if (clearing && action !== 'state') return;
  if (action === 'navigate' && typeof value === 'string') navigate(value);
  else if (action === 'new') createTab();
  else if (action === 'activate' && Number.isInteger(value)) activate(value);
  else if (action === 'close' && Number.isInteger(value)) closeTab(value);
  else if (action === 'home') navigate(HOME);
  else if (action === 'back' || action === 'forward') history(action);
  else if (action === 'reload') {
    const wc = active()?.view?.webContents;
    if (wc?.isLoading()) wc.stop(); else wc?.reload();
  } else if (action === 'clear') {
    clearing = true;
    for (const id of [...tabs.keys()]) {
      const tab = tabs.get(id);
      if (tab.view && tab.view === mounted) { win.contentView.removeChildView(mounted); mounted = null; }
      tabs.delete(id); tab.view?.webContents.close();
    }
    publish();
    try {
      await browsing.clearStorageData();
      await browsing.clearCache();
      await browsing.closeAllConnections();
      if (win && !win.isDestroyed()) {
        createTab(); win.webContents.send('browser:notice', 'Session cleared.');
      }
    } finally { clearing = false; publish(); }
  } else if (action === 'state') publish();
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // No "persist:" prefix: website cookies/storage live only for this process.
  browsing = session.fromPartition('mint-session');
  browsing.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  browsing.setPermissionCheckHandler(() => false);
  browsing.setDevicePermissionHandler(() => false);
  browsing.setSpellCheckerEnabled(false);
  browsing.on('file-system-access-restricted', (_event, _details, callback) => callback('deny'));
  browsing.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({
      title: 'Save download', defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename()))
    });
    item.on('done', (_event, state) => {
      if (win && !win.isDestroyed()) win.webContents.send('browser:notice', state === 'completed' ? 'Download saved.' : 'Download did not complete.');
    });
  });
  win = new BrowserWindow({ width: 1360, height: 900, minWidth: 800, minHeight: 560,
    title: 'Mint Browser', icon: path.join(__dirname, 'icon.png'), backgroundColor: '#101312', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('resize', layout);
  win.once('ready-to-show', () => { win.show(); publish(); });
  win.on('closed', () => {
    for (const tab of tabs.values()) tab.view?.webContents.close();
    tabs.clear(); mounted = null; win = null;
  });
  installKeys(win.webContents);
  ipcMain.on('browser:command', (event, action, value) => {
    command(event, action, value).catch(() => {
      if (win && !win.isDestroyed()) win.webContents.send('browser:notice', 'This action could not be completed. Please try again.');
    });
  });
  createTab();
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
