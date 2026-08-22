/**
 * backup.js — automated, local, timestamped backups of the SQLite file.
 *
 * Patient data is sensitive, so this deliberately keeps N recent snapshots
 * on disk (default 30) rather than a single overwritten copy, so a bad
 * write or accidental deletion earlier in the day is still recoverable.
 *
 * This module only touches files — it does not know about Electron —
 * so it can be exercised directly by a plain Node script (see test/).
 */
const fs = require("fs");
const path = require("path");

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/** Copies dbPath (+ WAL/SHM sidecar files, if present) into backupDir. */
function runBackup(dbPath, backupDir, keep = 30) {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = timestamp();
  const base = path.basename(dbPath);
  const destDir = path.join(backupDir, stamp);
  fs.mkdirSync(destDir, { recursive: true });

  const sidecars = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  let copied = 0;
  for (const src of sidecars) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(destDir, path.basename(src)));
      copied++;
    }
  }
  if (copied === 0) throw new Error(`Nothing to back up — no database found at ${dbPath}`);

  pruneOldBackups(backupDir, keep);
  return destDir;
}

function listBackups(backupDir) {
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter((f) => fs.statSync(path.join(backupDir, f)).isDirectory())
    .sort()
    .reverse();
}

function pruneOldBackups(backupDir, keep) {
  const all = listBackups(backupDir);
  const excess = all.slice(keep);
  for (const dirName of excess) {
    fs.rmSync(path.join(backupDir, dirName), { recursive: true, force: true });
  }
}

/** Restores a chosen backup snapshot over the live database.
 *  Caller MUST close the live db connection before calling this,
 *  and reopen it afterwards. */
function restoreBackup(backupDir, snapshotName, dbPath) {
  const src = path.join(backupDir, snapshotName, path.basename(dbPath));
  if (!fs.existsSync(src)) throw new Error("Backup snapshot not found: " + snapshotName);
  fs.copyFileSync(src, dbPath);
  for (const ext of ["-wal", "-shm"]) {
    const sidecar = path.join(backupDir, snapshotName, path.basename(dbPath) + ext);
    const destSidecar = dbPath + ext;
    if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, destSidecar);
    else if (fs.existsSync(destSidecar)) fs.rmSync(destSidecar);
  }
  return true;
}

module.exports = { runBackup, listBackups, pruneOldBackups, restoreBackup };
