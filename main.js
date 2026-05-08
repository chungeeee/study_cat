const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

let panelWindow = null;
let catWindow = null;
let tray = null;
let panelClickThrough = false;

// === Settings persistence ===
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
let settings = {};
function loadSettings() {
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
  catch { settings = {}; }
}
function saveSettings() {
  try { fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2)); } catch {}
}
loadSettings();

// === Cat icon (cropped from sheet1.png) ===
function buildCatIcon(size) {
  try {
    const sheetPath = path.join(__dirname, 'assets', 'cat', 'sheet1.png');
    const full = nativeImage.createFromPath(sheetPath);
    if (full.isEmpty()) return null;
    const { width, height } = full.getSize();
    const cellW = Math.floor(width / 6);
    const cellH = Math.floor(height / 3);
    const cropped = full.crop({ x: 0, y: 0, width: cellW, height: cellH });
    return cropped.resize({ width: size, height: size, quality: 'best' });
  } catch (e) {
    return null;
  }
}

function createPanelWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  const winWidth = 280;
  const winHeight = 290;

  const icoPath = path.join(__dirname, 'assets', 'cat', 'icon.ico');
  const winIcon = fs.existsSync(icoPath) ? icoPath : (buildCatIcon(64) || undefined);

  panelWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: width - winWidth - 24,
    y: height - winHeight - 24,
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    icon: winIcon,
    title: 'StudyCat',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  panelWindow.setAlwaysOnTop(true, 'screen-saver');
  panelWindow.setVisibleOnAllWorkspaces(true);
  if (winIcon) panelWindow.setIcon(winIcon);
  panelWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Send panel bounds to cat window so it avoids walking over the panel
  const sendPanelBounds = () => {
    if (!catWindow || catWindow.isDestroyed()) return;
    if (!panelWindow || panelWindow.isDestroyed() || !panelWindow.isVisible()) {
      catWindow.webContents.send('panel-bounds', null);
      return;
    }
    const b = panelWindow.getBounds();
    catWindow.webContents.send('panel-bounds', { x: b.x, y: b.y, width: b.width, height: b.height });
  };
  panelWindow.on('move', sendPanelBounds);
  panelWindow.on('resize', sendPanelBounds);
  panelWindow.on('show', sendPanelBounds);
  panelWindow.on('hide', sendPanelBounds);
  // Initial send when cat window is ready
  setTimeout(sendPanelBounds, 800);

  panelWindow.on('closed', () => { panelWindow = null; });
}

function createCatWindow() {
  const display = screen.getPrimaryDisplay();
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;

  const winSize = 130;

  catWindow = new BrowserWindow({
    width: winSize,
    height: winSize,
    x: dx + dw / 2 - winSize / 2,
    y: dy + dh - winSize - 60,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload-cat.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  catWindow.setAlwaysOnTop(true, 'screen-saver');
  catWindow.setVisibleOnAllWorkspaces(true);
  catWindow.setIgnoreMouseEvents(true, { forward: true });
  catWindow.loadFile(path.join(__dirname, 'cat-window', 'cat.html'));

  // Visibility from saved settings
  if (settings.catVisible === false) catWindow.hide();

  const sendArea = () => {
    if (!catWindow || catWindow.isDestroyed()) return;
    const displays = screen.getAllDisplays().map(d => ({
      x: d.workArea.x, y: d.workArea.y,
      width: d.workArea.width, height: d.workArea.height,
    }));
    catWindow.webContents.send('work-area', { displays });
  };
  catWindow.webContents.on('did-finish-load', () => {
    sendArea();
    if (settings.catSize) catWindow.webContents.send('cat-size', settings.catSize);
  });
  screen.on('display-metrics-changed', sendArea);
  screen.on('display-added', sendArea);
  screen.on('display-removed', sendArea);
}

function createTray() {
  const icon = buildCatIcon(16);
  tray = new Tray(icon || nativeImage.createEmpty());
  const menu = Menu.buildFromTemplate([
    { label: '패널 보이기/숨기기 (Alt+H)', click: togglePanel },
    { label: '고양이 보이기/숨기기 (Alt+K)', click: toggleCat },
    { label: '패널 클릭 통과 (Alt+C)', type: 'checkbox', checked: false,
      click: (item) => togglePanelClickThrough(item.checked) },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]);
  tray.setToolTip('StudyCat');
  tray.setContextMenu(menu);
  tray.on('click', togglePanel);
}

function togglePanel() {
  if (!panelWindow) return;
  if (panelWindow.isVisible()) {
    panelWindow.hide();
  } else {
    if (panelClickThrough) togglePanelClickThrough(false);
    panelWindow.show();
  }
}
function toggleCat() {
  if (!catWindow) return;
  const willShow = !catWindow.isVisible();
  willShow ? catWindow.show() : catWindow.hide();
  settings.catVisible = willShow;
  saveSettings();
}
function togglePanelClickThrough(force) {
  panelClickThrough = typeof force === 'boolean' ? force : !panelClickThrough;
  if (panelWindow) {
    panelWindow.setIgnoreMouseEvents(panelClickThrough, { forward: true });
    panelWindow.webContents.send('click-through-changed', panelClickThrough);
  }
}

function notify(title, body) {
  try {
    const n = new Notification({ title, body, icon: buildCatIcon(64) || undefined });
    n.show();
  } catch {}
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.chungeeee.studycat');
  createPanelWindow();
  createCatWindow();
  createTray();

  // Re-assert always-on-top every 3s — Windows can demote it after fullscreen
  // apps, UAC prompts, alt-tab, or DWM recompositions.
  setInterval(() => {
    if (panelWindow && !panelWindow.isDestroyed() && panelWindow.isVisible()) {
      panelWindow.setAlwaysOnTop(true, 'screen-saver');
    }
    if (catWindow && !catWindow.isDestroyed() && catWindow.isVisible()) {
      catWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }, 3000);

  globalShortcut.register('Alt+C', () => togglePanelClickThrough());
  globalShortcut.register('CommandOrControl+Alt+C', () => togglePanelClickThrough(false));
  globalShortcut.register('Alt+H', togglePanel);
  globalShortcut.register('Alt+K', toggleCat);

  ipcMain.on('quit', () => app.quit());
  ipcMain.on('hide', () => panelWindow && panelWindow.hide());
  ipcMain.on('minimize', () => panelWindow && panelWindow.minimize());
  ipcMain.on('toggle-click-through', () => togglePanelClickThrough());
  ipcMain.on('toggle-cat', () => toggleCat());
  ipcMain.on('set-always-on-top', (_e, v) =>
    panelWindow && panelWindow.setAlwaysOnTop(!!v, 'screen-saver'));

  ipcMain.on('hot-zone', (_e, active) => {
    if (panelClickThrough && panelWindow) {
      panelWindow.setIgnoreMouseEvents(!active, { forward: true });
    }
  });

  ipcMain.on('cat-mood', (_e, mood) => {
    if (catWindow && !catWindow.isDestroyed()) catWindow.webContents.send('mood', mood);
  });
  ipcMain.on('cat-celebrate', () => {
    if (catWindow && !catWindow.isDestroyed()) catWindow.webContents.send('celebrate');
  });
  ipcMain.on('cat-bounds', (_e, b) => {
    if (!catWindow || catWindow.isDestroyed()) return;
    catWindow.setBounds({
      x: Math.round(b.x), y: Math.round(b.y),
      width: Math.round(b.w), height: Math.round(b.h),
    });
  });

  // Settings
  ipcMain.handle('settings-get', () => settings);
  ipcMain.on('settings-set', (_e, key, value) => {
    settings[key] = value;
    saveSettings();
    if (key === 'catSize' && catWindow && !catWindow.isDestroyed()) {
      catWindow.webContents.send('cat-size', value);
    }
  });

  // Notifications
  ipcMain.on('notify', (_e, { title, body }) => notify(title, body));
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (tray) { tray.destroy(); tray = null; } });
app.on('will-quit', () => globalShortcut.unregisterAll());
