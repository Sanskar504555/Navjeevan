const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  kvGet: (key, fallback) => ipcRenderer.invoke("kv:get", key, fallback),
  kvSet: (key, value) => ipcRenderer.invoke("kv:set", key, value),
  kvDelete: (key) => ipcRenderer.invoke("kv:delete", key),

  login: (username, password) => ipcRenderer.invoke("auth:login", username, password),
  changePassword: (username, newPassword) => ipcRenderer.invoke("auth:changePassword", username, newPassword),
  addUser: (userInput) => ipcRenderer.invoke("auth:addUser", userInput),
  listUsers: () => ipcRenderer.invoke("auth:listUsers"),

  backupRun: () => ipcRenderer.invoke("backup:run"),
  backupList: () => ipcRenderer.invoke("backup:list"),
  backupRestore: (snapshotName) => ipcRenderer.invoke("backup:restore", snapshotName),
  backupOpenFolder: () => ipcRenderer.invoke("backup:openFolder"),
});
