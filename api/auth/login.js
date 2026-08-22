const bcrypt = require("bcryptjs");
const { prisma } = require("../_lib/prisma");
const {
  createToken,
  setSessionCookie,
  safeUser,
} = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { email, password } = req.body || {};

    const input = String(email || "")
      .trim()
      .toLowerCase();

    if (!input || !password) {
      return res.status(400).json({
        error: "Username and password are required",
      });
    }

    // Preserve the existing UI's "admin" username while the database
    // stores the canonical email address. Both forms are accepted.
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input },
          { email: { startsWith: `${input}@` } },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    const validPassword = await bcrypt.compare(
      String(password),
      user.passwordHash
    );

    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    const token = createToken(user);

    setSessionCookie(res, token);

    return res.status(200).json({
      user: safeUser(user),
    });
  } catch (error) {
    console.error("[web-auth/login]", error);

    return res.status(500).json({
      error: "Authentication service unavailable",
    });
  }
};