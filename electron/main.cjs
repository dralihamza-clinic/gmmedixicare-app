const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const path = require("node:path");
const { autoUpdater } = require("electron-updater");

// Set by `npm run dev` so the window loads the Vite dev server.
// In a packaged / `npm start` run this is undefined and dist/index.html is loaded.
const devUrl = process.env.VITE_DEV_SERVER_URL;

let mainWindow = null;

function isInternalUrl(url) {
  if (devUrl && url.startsWith(devUrl)) return true;
  return url.startsWith("file://");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: "GMMedixicare Staff",
    backgroundColor: "#faf9f6",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Never let the app window navigate away from itself.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isInternalUrl(url)) event.preventDefault();
  });

  // External links open in the user's browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Auto-update from GitHub Releases (publish config in package.json). The
// update downloads in the background; once it's ready the user picks
// "Restart now" or "Later" — with Later it installs on the next quit.
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // re-check every 6 hours

function setupAutoUpdates() {
  autoUpdater.logger = console;
  let promptedVersion = null;

  autoUpdater.on("update-downloaded", async (info) => {
    // Periodic checks can re-fire this for the same download; ask once.
    if (promptedVersion === info.version) return;
    promptedVersion = info.version;

    const options = {
      type: "info",
      title: "Update ready",
      message: `GMMedixicare ${info.version} is ready to install.`,
      detail:
        "Restart now to finish updating. If you choose Later, the update installs automatically the next time you close the app.",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
    };
    const { response } = mainWindow
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);
    if (response === 0) autoUpdater.quitAndInstall();
  });

  // Offline clinics or GitHub hiccups shouldn't interrupt staff; just log.
  autoUpdater.on("error", (err) => {
    console.error("Auto-update failed:", err == null ? "unknown" : err.message ?? err);
  });

  const check = () =>
    autoUpdater.checkForUpdates().catch((err) => {
      console.error("Update check failed:", err?.message ?? err);
    });
  check();
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
}

// Only allow one copy of the app to run at a time.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (app.isPackaged) Menu.setApplicationMenu(null);
    createWindow();
    // Packaged builds only: `npm run dev` / `npm start` have no
    // app-update.yml and nothing to update.
    if (app.isPackaged) setupAutoUpdates();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
