const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { KVStore } = require("./db");
const auth = require("./auth");
const backup = require("./backup");

const isDev = !app.isPackaged;

// All patient data lives under the OS's per-app data folder, e.g. on
// Windows: C:\Users\<user>\AppData\Roaming\Navjeevan Fertility EMR\
const userData = app.getPath("userData");
const DB_PATH = path.join(userData, "navjeevan.db");
const BACKUP_DIR = path.join(userData, "backups");
const BACKUP_RETENTION = 30; // keep the last 30 automatic snapshots

let store;
let mainWindow;
let backupTimer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: "Navjeevan Fertility EMR",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
    mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
      console.error(`[did-fail-load] ${code} ${desc} ${url}`);
    });
  }
}

function runScheduledBackup() {
  try {
    const dest = backup.runBackup(DB_PATH, BACKUP_DIR, BACKUP_RETENTION);
    console.log("[backup] snapshot written to", dest);
  } catch (e) {
    console.error("[backup] failed:", e.message);
  }
}

app.whenReady().then(() => {
  store = new KVStore(DB_PATH);
  auth.ensureSeeded(store);

  // Automatic local backup: once on launch, then every 6 hours while the
  // app is running. Clinics can additionally copy the `backups` folder to
  // a USB drive / cloud-synced folder for off-site protection.
  runScheduledBackup();
  backupTimer = setInterval(runScheduledBackup, 6 * 60 * 60 * 1000);

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  if (backupTimer) clearInterval(backupTimer);
  runScheduledBackup(); // always leave a fresh snapshot on close
  if (store) store.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function registerIpcHandlers() {
  // Generic key-value storage — mirrors the renderer's existing get/set/delete calls.
  ipcMain.handle("kv:get", (_evt, key, fallback) => store.get(key, fallback));
  ipcMain.handle("kv:set", (_evt, key, value) => store.set(key, value));
  ipcMain.handle("kv:delete", (_evt, key) => store.delete(key));

  // Auth
  ipcMain.handle("auth:login", (_evt, username, password) => auth.login(store, username, password));
  ipcMain.handle("auth:changePassword", (_evt, username, newPassword) => auth.changePassword(store, username, newPassword));
  ipcMain.handle("auth:addUser", (_evt, userInput) => {
    try { auth.addUser(store, userInput); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle("auth:listUsers", () => (store.get("users", [])).map(({ passwordHash, ...safe }) => safe));

  // Backups
  ipcMain.handle("backup:run", () => backup.runBackup(DB_PATH, BACKUP_DIR, BACKUP_RETENTION));
  ipcMain.handle("backup:list", () => backup.listBackups(BACKUP_DIR));
  ipcMain.handle("backup:restore", async (_evt, snapshotName) => {
    store.close();
    backup.restoreBackup(BACKUP_DIR, snapshotName, DB_PATH);
    store = new KVStore(DB_PATH);
    return true;
  });
  ipcMain.handle("backup:openFolder", () => {
    require("electron").shell.openPath(BACKUP_DIR);
  });
}
