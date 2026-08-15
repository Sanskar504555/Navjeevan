/**
 * test-core.js — exercises db.js / auth.js / backup.js directly with
 * plain Node (no Electron, no display needed). Run with: npm run test:core
 */
const path = require("path");
const fs = require("fs");
const assert = require("assert");
const { KVStore } = require("../src/db");
const auth = require("../src/auth");
const backup = require("../src/backup");

const TMP_DIR = path.join(__dirname, ".tmp-test-run");
fs.rmSync(TMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const DB_PATH = path.join(TMP_DIR, "navjeevan.db");
const BACKUP_DIR = path.join(TMP_DIR, "backups");

let pass = 0;
function check(label, fn) {
  fn();
  pass++;
  console.log(`  ✓ ${label}`);
}

console.log("Navjeevan EMR — core data layer test\n");

// 1. Open a fresh database
let store = new KVStore(DB_PATH);
check("database file created on disk", () => {
  assert.ok(fs.existsSync(DB_PATH), "db file should exist");
});

// 2. Key/value get/set/delete
check("kv set + get round-trips JSON data", () => {
  store.set("patients", [{ id: "p1", patientName: "Test Patient" }]);
  const got = store.get("patients", []);
  assert.strictEqual(got.length, 1);
  assert.strictEqual(got[0].patientName, "Test Patient");
});
check("kv get returns fallback for missing key", () => {
  assert.deepStrictEqual(store.get("does-not-exist", []), []);
});
check("kv delete removes the key", () => {
  store.set("scratch", { a: 1 });
  store.delete("scratch");
  assert.strictEqual(store.get("scratch", null), null);
});

// 3. Auth: seeding, hashing, login
check("admin account is seeded on first run (hashed, not plaintext)", () => {
  const users = auth.ensureSeeded(store);
  assert.strictEqual(users.length, 1);
  assert.strictEqual(users[0].username, "admin");
  assert.notStrictEqual(users[0].passwordHash, "admin123", "password must be hashed, not stored as plaintext");
  assert.ok(users[0].passwordHash.startsWith("$2"), "should be a bcrypt hash");
});
check("login succeeds with correct password", () => {
  const u = auth.login(store, "admin", "admin123");
  assert.ok(u, "login should succeed");
  assert.strictEqual(u.username, "admin");
  assert.strictEqual(u.passwordHash, undefined, "hash must never be returned to the caller");
});
check("login fails with wrong password", () => {
  assert.strictEqual(auth.login(store, "admin", "wrong-password"), null);
});
check("password can be changed and old password stops working", () => {
  auth.changePassword(store, "admin", "NewSecret456!");
  assert.strictEqual(auth.login(store, "admin", "admin123"), null);
  assert.ok(auth.login(store, "admin", "NewSecret456!"));
});
check("a second staff user can be added", () => {
  auth.addUser(store, { username: "frontdesk", password: "Reception789", fullName: "Front Desk", role: "Receptionist" });
  assert.ok(auth.login(store, "frontdesk", "Reception789"));
});

// 4. Backups
check("backup creates a timestamped snapshot", () => {
  const dest = backup.runBackup(DB_PATH, BACKUP_DIR, 30);
  assert.ok(fs.existsSync(dest));
  assert.ok(fs.existsSync(path.join(dest, "navjeevan.db")));
});
check("backup list shows the snapshot, newest first", () => {
  const list = backup.listBackups(BACKUP_DIR);
  assert.ok(list.length >= 1);
});
check("old backups beyond the retention count are pruned", () => {
  for (let i = 0; i < 5; i++) backup.runBackup(DB_PATH, BACKUP_DIR, 3);
  const list = backup.listBackups(BACKUP_DIR);
  assert.ok(list.length <= 3, `expected at most 3 backups retained, got ${list.length}`);
});
check("restoring a backup brings back deleted data", () => {
  store.set("patients", [{ id: "p1", patientName: "Will Be Restored" }]);
  const snap = backup.runBackup(DB_PATH, BACKUP_DIR, 30);
  store.set("patients", []); // simulate accidental data loss
  store.close();
  backup.restoreBackup(BACKUP_DIR, path.basename(snap), DB_PATH);
  store = new KVStore(DB_PATH);
  const restored = store.get("patients", []);
  assert.strictEqual(restored.length, 1);
  assert.strictEqual(restored[0].patientName, "Will Be Restored");
});

store.close();
fs.rmSync(TMP_DIR, { recursive: true, force: true });

console.log(`\n${pass} checks passed. Core data layer (SQLite + bcrypt auth + backup/restore) is working.`);
