/**
 * auth.js — Supabase & Prisma authentication for the Electron renderer API.
 */

const bcrypt = require("bcryptjs");
const { prisma } = require("./lib/prisma");

const SALT_ROUNDS = 10;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function hashPassword(plain) {
  return bcrypt.hash(String(plain), SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (typeof hash !== "string" || !hash) return false;

  try {
    return await bcrypt.compare(String(plain), hash);
  } catch {
    return false;
  }
}

/**
 * Ensures at least one admin account exists.
 *
 * Development/default credentials:
 * Email: admin@navjeevan.com
 * Password: admin123
 *
 * IMPORTANT:
 * Change this password after first login before production use.
 */
async function ensureSeeded() {
  try {
    const userCount = await prisma.user.count();

    if (userCount > 0) return;

    const defaultPasswordHash = await hashPassword("admin123");

    await prisma.user.create({
      data: {
        fullName: "Dr. Admin",
        email: "admin@navjeevan.com",
        passwordHash: defaultPasswordHash,
        role: "ADMIN",
      },
    });

    console.log("[auth] Initial admin account created.");
  } catch (error) {
    console.error("[auth] Error seeding initial admin user:", error);
  }
}

/**
 * Authenticates a user using email + password.
 *
 * Returns a safe user object without passwordHash.
 * Returns null if authentication fails.
 */
async function login(email, password) {
  await ensureSeeded();

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  const { passwordHash, ...safeUser } = user;

  return safeUser;
}

/**
 * Changes the password of the specified user.
 */
async function changePassword(email, newPassword) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  if (typeof newPassword !== "string" || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!existingUser) {
    throw new Error("User not found");
  }

  const newHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: {
      email: normalizedEmail,
    },
    data: {
      passwordHash: newHash,
    },
  });

  return true;
}

/**
 * Adds a new user.
 */
async function addUser({
  email,
  password,
  fullName,
  role = "STAFF",
}) {
  await ensureSeeded();

  const normalizedEmail = normalizeEmail(email);
  const normalizedFullName = String(fullName || "").trim();
  const normalizedRole = String(role || "STAFF").toUpperCase();

  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  if (!normalizedFullName) {
    throw new Error("Full name is required");
  }

  if (typeof password !== "string" || password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  const validRoles = [
    "ADMIN",
    "DOCTOR",
    "LAB_TECH",
    "STAFF",
  ];

  if (!validRoles.includes(normalizedRole)) {
    throw new Error("Invalid user role");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (existingUser) {
    throw new Error("User already exists with this email");
  }

  const passwordHash = await hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      fullName: normalizedFullName,
      email: normalizedEmail,
      passwordHash,
      role: normalizedRole,
    },
  });

  const {
    passwordHash: _passwordHash,
    ...safeUser
  } = newUser;

  return safeUser;
}

/**
 * Lists all users without exposing password hashes.
 */
async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

/**
 * Gets a single user by ID.
 */
async function getUserById(id) {
  if (!id) {
    throw new Error("User ID is required");
  }

  return prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Updates user profile information.
 *
 * Password changes remain handled separately by changePassword().
 */
async function updateUser(id, { fullName, email, role }) {
  if (!id) {
    throw new Error("User ID is required");
  }

  const data = {};

  if (typeof fullName === "string") {
    const normalizedFullName = fullName.trim();

    if (!normalizedFullName) {
      throw new Error("Full name cannot be empty");
    }

    data.fullName = normalizedFullName;
  }

  if (typeof email === "string") {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      throw new Error("Email cannot be empty");
    }

    data.email = normalizedEmail;
  }

  if (typeof role === "string") {
    const normalizedRole = role.toUpperCase();

    const validRoles = [
      "ADMIN",
      "DOCTOR",
      "LAB_TECH",
      "STAFF",
    ];

    if (!validRoles.includes(normalizedRole)) {
      throw new Error("Invalid user role");
    }

    data.role = normalizedRole;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("No changes supplied");
  }

  try {
    const updatedUser = await prisma.user.update({
      where: {
        id,
      },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  } catch (error) {
    if (error.code === "P2002") {
      throw new Error("Another user already exists with this email");
    }

    if (error.code === "P2025") {
      throw new Error("User not found");
    }

    throw error;
  }
}

/**
 * Deletes a user.
 *
 * We will protect this through the ADMIN authorization
 * layer in main.js.
 */
async function deleteUser(id) {
  if (!id) {
    throw new Error("User ID is required");
  }

  try {
    await prisma.user.delete({
      where: {
        id,
      },
    });

    return true;
  } catch (error) {
    if (error.code === "P2025") {
      throw new Error("User not found");
    }

    throw error;
  }
}

module.exports = {
  normalizeEmail,
  hashPassword,
  verifyPassword,
  ensureSeeded,
  login,
  changePassword,
  addUser,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
};