const jwt = require("jsonwebtoken");
const { prisma } = require("./prisma");

const JWT_SECRET = process.env.JWT_SECRET;

function getTokenFromRequest(req) {
  const cookieHeader = req.headers.cookie || "";

  const cookies = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim());

  const authCookie = cookies.find((cookie) =>
    cookie.startsWith("navjeevan_session=")
  );

  if (!authCookie) {
    return null;
  }

  return decodeURIComponent(
    authCookie.substring("navjeevan_session=".length)
  );
}

function createToken(user) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "8h",
    }
  );
}

function verifyToken(token) {
  if (!token || !JWT_SECRET) {
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function setSessionCookie(res, token) {
  const secure =
    process.env.NODE_ENV === "production"
      ? " Secure;"
      : "";

  res.setHeader(
    "Set-Cookie",
    `navjeevan_session=${encodeURIComponent(
      token
    )}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800;${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "navjeevan_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
  );
}

async function getCurrentUser(req) {
  const token = getTokenFromRequest(req);
  const payload = verifyToken(token);

  if (!payload?.userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: payload.userId,
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

async function requireUser(req) {
  const user = await getCurrentUser(req);

  if (!user) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  return user;
}

async function requireAdmin(req) {
  const user = await requireUser(req);

  if (user.role !== "ADMIN") {
    const error = new Error(
      "Administrator privileges required"
    );

    error.statusCode = 403;
    throw error;
  }

  return user;
}

function safeUser(user) {
  if (!user) return null;

  const {
    passwordHash,
    ...result
  } = user;

  return result;
}

module.exports = {
  createToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
  getCurrentUser,
  requireUser,
  requireAdmin,
  safeUser,
};