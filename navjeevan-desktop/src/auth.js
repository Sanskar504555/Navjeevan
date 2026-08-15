/**
 * auth.js — real password hashing, in place of the demo's plaintext check.
 *
 * Users are stored in the same kv store under the "users" key, but the
 * password field now holds a bcrypt hash, never the plaintext password.
 */
const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

function hashPassword(plain) {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

/** Seed a default admin account (username: admin, password: admin123) if
 *  no users exist yet — mirrors the demo's first-run behaviour. The clinic
 *  MUST change this password on first login in a real deployment. */
function ensureSeeded(store) {
  const users = store.get("users", null);
  if (users && users.length > 0) return users;
  const seeded = [{
    username: "admin",
    passwordHash: hashPassword("admin123"),
    fullName: "Dr. Admin",
    role: "Doctor / Admin",
  }];
  store.set("users", seeded);
  return seeded;
}

/** Returns the matching user (without the hash) on success, or null. */
function login(store, username, password) {
  const users = store.get("users", []);
  const u = users.find((x) => x.username.toLowerCase() === String(username).trim().toLowerCase());
  if (!u || !verifyPassword(password, u.passwordHash)) return null;
  const { passwordHash, ...safe } = u;
  return safe;
}

function changePassword(store, username, newPassword) {
  const users = store.get("users", []);
  const idx = users.findIndex((x) => x.username.toLowerCase() === String(username).trim().toLowerCase());
  if (idx === -1) return false;
  users[idx].passwordHash = hashPassword(newPassword);
  store.set("users", users);
  return true;
}

function addUser(store, { username, password, fullName, role }) {
  const users = store.get("users", []);
  if (users.some((x) => x.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already exists");
  }
  users.push({ username, passwordHash: hashPassword(password), fullName, role });
  store.set("users", users);
  return true;
}

module.exports = { hashPassword, verifyPassword, ensureSeeded, login, changePassword, addUser };
