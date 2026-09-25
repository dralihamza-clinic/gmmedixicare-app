const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("node:path");

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
    title: "GmMedixicare Staff",
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

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
