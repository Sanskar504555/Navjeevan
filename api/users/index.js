const { prisma } = require("../_lib/prisma");
const {
  requireAdmin,
  safeUser,
} = require("../_lib/auth");
const bcrypt = require("bcryptjs");

const VALID_ROLES = [
  "ADMIN",
  "DOCTOR",
  "LAB_TECH",
  "STAFF",
];

module.exports = async function handler(
  req,
  res
) {
  try {
    const admin = await requireAdmin(req);

    // ==========================================================
    // GET USERS
    // ==========================================================

    if (req.method === "GET") {
      const users =
        await prisma.user.findMany({
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

      return res.status(200).json({
        users,
      });
    }

    // ==========================================================
    // CREATE USER
    // ==========================================================

    if (req.method === "POST") {
      const {
        fullName,
        email,
        password,
        role = "STAFF",
      } = req.body || {};

      const normalizedEmail =
        String(email || "")
          .trim()
          .toLowerCase();

      const normalizedName =
        String(fullName || "").trim();

      const normalizedRole =
        String(role || "STAFF")
          .toUpperCase();

      if (!normalizedName) {
        return res.status(400).json({
          error: "Full name is required",
        });
      }

      if (!normalizedEmail) {
        return res.status(400).json({
          error: "Email is required",
        });
      }

      if (
        typeof password !== "string" ||
        password.length < 6
      ) {
        return res.status(400).json({
          error:
            "Password must be at least 6 characters long",
        });
      }

      if (
        !VALID_ROLES.includes(
          normalizedRole
        )
      ) {
        return res.status(400).json({
          error: "Invalid user role",
        });
      }

      const existing =
        await prisma.user.findUnique({
          where: {
            email: normalizedEmail,
          },
        });

      if (existing) {
        return res.status(409).json({
          error:
            "A user already exists with this email",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          10
        );

      const user =
        await prisma.user.create({
          data: {
            fullName: normalizedName,
            email: normalizedEmail,
            passwordHash,
            role: normalizedRole,
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

      return res.status(201).json({
        user,
      });
    }

    return res.status(405).json({
      error: "Method not allowed",
    });
  } catch (error) {
    console.error(
      "[web/users]",
      error
    );

    const status =
      error.statusCode || 500;

    return res.status(status).json({
      error:
        error.message ||
        "User management request failed",
    });
  }
};