// File: src/preload.js

const {
  contextBridge,
  ipcRenderer,
} = require("electron");

contextBridge.exposeInMainWorld("api", {

  // ============================================================
  // KEY-VALUE LOCAL CACHE STORAGE
  // ============================================================

  kvGet: (key, fallback) =>
    ipcRenderer.invoke(
      "kv:get",
      key,
      fallback
    ),

  kvSet: (key, value) =>
    ipcRenderer.invoke(
      "kv:set",
      key,
      value
    ),

  kvDelete: (key) =>
    ipcRenderer.invoke(
      "kv:delete",
      key
    ),

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  login: (email, password) =>
    ipcRenderer.invoke(
      "auth:login",
      email,
      password
    ),

  logout: () =>
    ipcRenderer.invoke(
      "auth:logout"
    ),

  getCurrentUser: () =>
    ipcRenderer.invoke(
      "auth:getCurrentUser"
    ),

  changePassword: (currentPassword, newPassword) =>
  ipcRenderer.invoke(
    "auth:changePassword",
    currentPassword,
    newPassword
  ),

  // ============================================================
  // ADMIN USER MANAGEMENT
  // ============================================================

  addUser: (userInput) =>
    ipcRenderer.invoke(
      "auth:addUser",
      userInput
    ),

  listUsers: () =>
    ipcRenderer.invoke(
      "auth:listUsers"
    ),

  getUserById: (userId) =>
    ipcRenderer.invoke(
      "auth:getUserById",
      userId
    ),

  updateUser: (
    userId,
    userInput
  ) =>
    ipcRenderer.invoke(
      "auth:updateUser",
      userId,
      userInput
    ),

  deleteUser: (userId) =>
    ipcRenderer.invoke(
      "auth:deleteUser",
      userId
    ),

  // ============================================================
  // LOCAL BACKUPS
  // ============================================================

  backupRun: () =>
    ipcRenderer.invoke(
      "backup:run"
    ),

  backupList: () =>
    ipcRenderer.invoke(
      "backup:list"
    ),

  backupRestore: (
    snapshotName
  ) =>
    ipcRenderer.invoke(
      "backup:restore",
      snapshotName
    ),

  backupOpenFolder: () =>
    ipcRenderer.invoke(
      "backup:openFolder"
    ),

  // ============================================================
  // PATIENT MANAGEMENT
  // ============================================================

  createPatient: (
    patientData
  ) =>
    ipcRenderer.invoke(
      "patient:create",
      patientData
    ),

  listPatients: (
    searchQuery
  ) =>
    ipcRenderer.invoke(
      "patient:list",
      searchQuery
    ),

  getPatientById: (id) =>
    ipcRenderer.invoke(
      "patient:getById",
      id
    ),

  // ============================================================
  // TEST REPORTS
  // ============================================================

  createTestReport: (
    reportData
  ) =>
    ipcRenderer.invoke(
      "report:create",
      reportData
    ),

  updateTestReport: (
    reportId,
    updateData
  ) =>
    ipcRenderer.invoke(
      "report:update",
      reportId,
      updateData
    ),
});