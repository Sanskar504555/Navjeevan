/**
 * db.js — local SQLite-backed key/value store.
 *
 * The renderer (React UI) already speaks a simple get/set/delete key-value
 * protocol (it was built against the browser storage API). Rather than
 * force a full relational schema migration, this module gives it a real
 * embedded database with the exact same shape: one row per key, JSON text
 * value. This is a completely standard, production-safe pattern for a
 * single-clinic desktop app — no server, no network, one file on disk.
 *
 * Each patient/prescriptions/cycles/billingItems/payments/users blob is
 * still stored as JSON under its own key, exactly as it was in the demo.
 * That keeps the (already-built) renderer code changes minimal while
 * giving you a real file-backed, crash-safe, backup-able database.
 */
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

function openDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL"); // crash-safe, better for concurrent read/write
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

class KVStore {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = openDatabase(dbPath);
    this._get = this.db.prepare("SELECT value FROM kv WHERE key = ?");
    this._set = this.db.prepare(
      "INSERT INTO kv (key, value, updated_at) VALUES (@key, @value, @updated_at) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    );
    this._del = this.db.prepare("DELETE FROM kv WHERE key = ?");
    this._keys = this.db.prepare("SELECT key FROM kv");
  }

  get(key, fallback = null) {
    const row = this._get.get(key);
    if (!row) return fallback;
    try { return JSON.parse(row.value); } catch (e) { return fallback; }
  }

  set(key, value) {
    this._set.run({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
    return true;
  }

  delete(key) {
    this._del.run(key);
    return true;
  }

  keys() {
    return this._keys.all().map((r) => r.key);
  }

  close() {
    this.db.close();
  }
}

module.exports = { KVStore, openDatabase };
