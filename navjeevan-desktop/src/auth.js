/**
 * auth.js — local authentication for the Electron renderer API.
 *
 * User records are stored in the KV store under "users". Passwords are
 * persisted only as bcrypt hashes. The compatibility path below migrates an
 * old demo record containing a plaintext `password` field after a successful
 * sign-in.
 */
const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), SALT_ROUNDS);
}

function verifyPassword(plain, hash) {
  if (typeof hash !== "string" || !hash) return false;

  try {
    return bcrypt.compareSync(String(plain), hash);
  } catch {
    return false;
  }
}

/**
 * Create the first-run administrator when the store has no valid user list.
 * The initial credentials are admin / admin123 and should be changed promptly.
 */
function ensureSeeded(store) {
  const storedUsers = store.get("users", null);
  if (Array.isArray(storedUsers) && storedUsers.length > 0) return storedUsers;

  const seeded = [
    {
      username: "admin",
      passwordHash: hashPassword("admin123"),
      fullName: "Dr. Admin",
      role: "Doctor / Admin",
    },
  ];
  store.set("users", seeded);
  return seeded;
}

/**
 * Return the matching user without credential fields, or null on failure.
 * Calling ensureSeeded here is essential: the sign-in IPC handler may be the
 * first code that accesses the users collection.
 */
function login(store, username, password) {
  const users = ensureSeeded(store);
  const normalizedUsername = normalizeUsername(username);
  const user = users.find((candidate) => normalizeUsername(candidate.username) === normalizedUsername);
  if (!user) return null;

  if (verifyPassword(password, user.passwordHash)) {
    const { passwordHash, password: _legacyPassword, ...safeUser } = user;
    return safeUser;
  }

  // One-time migration for installations created by the previous plaintext demo.
  if (typeof user.password === "string" && password === user.password) {
    const migratedUsers = users.map((candidate) => {
      if (candidate !== user) return candidate;
      const { password: _legacyPassword, ...withoutPlaintext } = candidate;
      return { ...withoutPlaintext, passwordHash: hashPassword(password) };
    });
    store.set("users", migratedUsers);

    const { passwordHash, password: _legacyPassword, ...safeUser } = user;
    return safeUser;
  }

  return null;
}

function changePassword(store, username, newPassword) {
  if (typeof newPassword !== "string" || newPassword.length < 6) return false;

  const users = ensureSeeded(store);
  const normalizedUsername = normalizeUsername(username);
  const index = users.findIndex((user) => normalizeUsername(user.username) === normalizedUsername);
  if (index === -1) return false;

  const { password: _legacyPassword, ...withoutPlaintext } = users[index];
  const nextUsers = [...users];
  nextUsers[index] = { ...withoutPlaintext, passwordHash: hashPassword(newPassword) };
  store.set("users", nextUsers);
  return true;
}

function addUser(store, { username, password, fullName, role }) {
  const users = ensureSeeded(store);
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) throw new Error("Username is required");
  if (typeof password !== "string" || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  if (users.some((user) => normalizeUsername(user.username) === normalizedUsername)) {
    throw new Error("Username already exists");
  }

  users.push({
    username: String(username).trim(),
    passwordHash: hashPassword(password),
    fullName: String(fullName || "").trim(),
    role: String(role || "").trim(),
  });
  store.set("users", users);
  return true;
}

module.exports = {
  hashPassword,
  verifyPassword,
  ensureSeeded,
  login,
  changePassword,
  addUser,
};
