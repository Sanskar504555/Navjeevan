const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { KVStore } = require("./db");
const auth = require("./auth");
const backup = require("./backup");
const { prisma } = require("./lib/prisma");

const isDev = !app.isPackaged;

// All patient data lives under the OS's per-app data folder.
const userData = app.getPath("userData");
const DB_PATH = path.join(userData, "navjeevan.db");
const BACKUP_DIR = path.join(userData, "backups");
const BACKUP_RETENTION = 30;

let store;
let mainWindow;
let backupTimer;

/**
 * Authenticated user for the current Electron application session.
 *
 * This is intentionally kept in the MAIN process rather than trusting
 * the renderer to tell us which user is logged in.
 */
let authenticatedUser = null;

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

  mainWindow.loadFile(
    path.join(__dirname, "..", "renderer", "index.html")
  );

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });

    mainWindow.webContents.on(
      "did-fail-load",
      (_e, code, desc, url) => {
        console.error(
          `[did-fail-load] ${code} ${desc} ${url}`
        );
      }
    );
  }
}

function runScheduledBackup() {
  try {
    const dest = backup.runBackup(
      DB_PATH,
      BACKUP_DIR,
      BACKUP_RETENTION
    );

    console.log("[backup] snapshot written to", dest);
  } catch (e) {
    console.error("[backup] failed:", e.message);
  }
}

/**
 * Requires an authenticated user.
 */
function requireAuthenticatedUser() {
  if (!authenticatedUser) {
    throw new Error("Authentication required");
  }

  return authenticatedUser;
}

/**
 * Requires the currently authenticated user to be an ADMIN.
 */
function requireAdmin() {
  const user = requireAuthenticatedUser();

  if (user.role !== "ADMIN") {
    throw new Error("Administrator privileges required");
  }

  return user;
}

app.whenReady().then(async () => {
  store = new KVStore(DB_PATH);

  // Ensure initial admin exists in PostgreSQL.
  await auth.ensureSeeded();

  runScheduledBackup();

  backupTimer = setInterval(
    runScheduledBackup,
    6 * 60 * 60 * 1000
  );

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  if (backupTimer) {
    clearInterval(backupTimer);
  }

  runScheduledBackup();

  authenticatedUser = null;

  if (store) {
    store.close();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerIpcHandlers() {

  // ============================================================
  // GENERIC KEY-VALUE STORAGE
  // ============================================================

  ipcMain.handle(
  "auth:changePassword",
  async (_evt, currentPassword, newPassword) => {
    const user = requireAuthenticatedUser();

    console.log("[PASSWORD DEBUG] authenticated user:", {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    console.log(
      "[PASSWORD DEBUG] current password received:",
      typeof currentPassword,
      currentPassword ? `length=${currentPassword.length}` : "EMPTY"
    );

    const verifiedUser = await auth.login(
      user.email,
      currentPassword
    );

    console.log(
      "[PASSWORD DEBUG] bcrypt verification:",
      !!verifiedUser
    );

    if (!verifiedUser) {
      throw new Error("Current password is incorrect");
    }

    await auth.changePassword(
      user.email,
      newPassword
    );

    console.log(
      "[PASSWORD DEBUG] password successfully changed for:",
      user.email
    );

    return true;
  }
);

  ipcMain.handle(
    "kv:set",
    (_evt, key, value) => store.set(key, value)
  );

  ipcMain.handle(
    "kv:delete",
    (_evt, key) => store.delete(key)
  );

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  ipcMain.handle(
    "auth:login",
    async (_evt, email, password) => {
      const user = await auth.login(email, password);

      if (!user) {
        authenticatedUser = null;
        return null;
      }

      // Store the authenticated user inside the Electron
      // main process. Do not trust the renderer for authorization.
      authenticatedUser = user;

      console.log(
        `[auth] Login successful: ${user.email} (${user.role})`
      );

      return user;
    }
  );

  ipcMain.handle(
    "auth:logout",
    async () => {
      authenticatedUser = null;

      console.log("[auth] User logged out.");

      return true;
    }
  );

  ipcMain.handle(
    "auth:getCurrentUser",
    async () => {
      return authenticatedUser;
    }
  );

  // ============================================================
  // CURRENT USER PASSWORD
  // ============================================================

  

  // ============================================================
  // ADMIN USER MANAGEMENT
  // ============================================================

  ipcMain.handle(
    "auth:addUser",
    async (_evt, userInput) => {
      try {
        requireAdmin();

        const user = await auth.addUser(userInput);

        return {
          ok: true,
          user,
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message,
        };
      }
    }
  );

  ipcMain.handle(
    "auth:listUsers",
    async () => {
      try {
        requireAdmin();

        return await auth.listUsers();
      } catch (e) {
        console.error(
          "[auth:listUsers]",
          e.message
        );

        return {
          ok: false,
          error: e.message,
        };
      }
    }
  );

  ipcMain.handle(
    "auth:getUserById",
    async (_evt, userId) => {
      try {
        requireAdmin();

        const user = await auth.getUserById(userId);

        return {
          ok: true,
          user,
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message,
        };
      }
    }
  );

  ipcMain.handle(
    "auth:updateUser",
    async (_evt, userId, userInput) => {
      try {
        const currentUser = requireAdmin();

        // Prevent an admin from accidentally removing their
        // own ADMIN role.
        if (
          userId === currentUser.id &&
          userInput?.role &&
          userInput.role.toUpperCase() !== "ADMIN"
        ) {
          return {
            ok: false,
            error:
              "You cannot remove your own administrator role.",
          };
        }

        const user = await auth.updateUser(
          userId,
          userInput
        );

        // If the admin changed their own name/email,
        // keep the current session synchronized.
        if (userId === currentUser.id) {
          authenticatedUser = {
            ...authenticatedUser,
            ...user,
          };
        }

        return {
          ok: true,
          user,
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message,
        };
      }
    }
  );

  ipcMain.handle(
    "auth:deleteUser",
    async (_evt, userId) => {
      try {
        const currentUser = requireAdmin();

        // Never allow an admin to delete themselves.
        if (userId === currentUser.id) {
          return {
            ok: false,
            error: "You cannot delete your own account.",
          };
        }

        // Prevent deleting the last remaining admin.
        const targetUser = await auth.getUserById(userId);

        if (!targetUser) {
          return {
            ok: false,
            error: "User not found.",
          };
        }

        if (targetUser.role === "ADMIN") {
          const users = await auth.listUsers();

          const adminCount = users.filter(
            (user) => user.role === "ADMIN"
          ).length;

          if (adminCount <= 1) {
            return {
              ok: false,
              error:
                "The last administrator account cannot be deleted.",
            };
          }
        }

        await auth.deleteUser(userId);

        return {
          ok: true,
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message,
        };
      }
    }
  );

  // ============================================================
  // BACKUPS
  // ============================================================

  ipcMain.handle(
    "backup:run",
    () =>
      backup.runBackup(
        DB_PATH,
        BACKUP_DIR,
        BACKUP_RETENTION
      )
  );

  ipcMain.handle(
    "backup:list",
    () =>
      backup.listBackups(BACKUP_DIR)
  );

  ipcMain.handle(
    "backup:restore",
    async (_evt, snapshotName) => {
      store.close();

      backup.restoreBackup(
        BACKUP_DIR,
        snapshotName,
        DB_PATH
      );

      store = new KVStore(DB_PATH);

      return true;
    }
  );

  ipcMain.handle(
    "backup:openFolder",
    () => {
      shell.openPath(BACKUP_DIR);
    }
  );

  // ============================================================
  // PATIENT MANAGEMENT
  // ============================================================

  ipcMain.handle(
    "patient:create",
    async (_evt, patientData) => {
      try {
        requireAuthenticatedUser();

        const patients = store.get(
          "patients",
          []
        );

        const newPatient = {
          id:
            patientData.id ||
            `PAT-${Date.now()}`,

          ...patientData,

          createdAt:
            new Date().toISOString(),
        };

        patients.push(newPatient);

        store.set(
          "patients",
          patients
        );

        return {
          ok: true,
          patient: newPatient,
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message,
        };
      }
    }
  );

  ipcMain.handle(
    "patient:list",
    async (_evt, searchQuery) => {
      try {
        requireAuthenticatedUser();

        let patients = store.get(
          "patients",
          []
        );

        if (searchQuery) {
          const q =
            searchQuery.toLowerCase();

          patients = patients.filter(
            (p) =>
              (p.name &&
                p.name
                  .toLowerCase()
                  .includes(q)) ||

              (p.phone &&
                p.phone.includes(q)) ||

              (p.id &&
                p.id
                  .toLowerCase()
                  .includes(q))
          );
        }

        return {
          ok: true,
          patients,
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message,
        };
      }
    }
  );

  ipcMain.handle(
    "patient:getById",
    async (_evt, id) => {
      try {
        requireAuthenticatedUser();

        const patients = store.get(
          "patients",
          []
        );

        const patient =
          patients.find(
            (p) => p.id === id
          );

        return {
          ok: true,
          patient: patient || null,
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message,
        };
      }
    }
  );

  // ============================================================
  // TEST REPORTS
  // ============================================================

  ipcMain.handle(
    "report:create",
    async (_evt, reportData) => {
      try {
        requireAuthenticatedUser();

        const reports = store.get(
          "test_reports",
          []
        );

        const newReport = {
          id:
            reportData.id ||
            `REP-${Date.now()}`,

          ...reportData,

          createdAt:
            new Date().toISOString(),

          createdBy:
            authenticatedUser.id,
        };

        reports.push(newReport);

        store.set(
          "test_reports",
          reports
        );

        return {
          ok: true,
          report: newReport,
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message,
        };
      }
    }
  );

  ipcMain.handle(
    "report:update",
    async (
      _evt,
      reportId,
      updateData
    ) => {
      try {
        requireAuthenticatedUser();

        const reports = store.get(
          "test_reports",
          []
        );

        const index =
          reports.findIndex(
            (r) => r.id === reportId
          );

        if (index === -1) {
          return {
            ok: false,
            error: "Report not found",
          };
        }

        reports[index] = {
          ...reports[index],
          ...updateData,
          updatedAt:
            new Date().toISOString(),
        };

        store.set(
          "test_reports",
          reports
        );

        return {
          ok: true,
          report: reports[index],
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message,
        };
      }
    }
  );
}