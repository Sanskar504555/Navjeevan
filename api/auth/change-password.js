const bcrypt = require("bcryptjs");
const { prisma } = require("../_lib/prisma");
const {
  requireUser,
} = require("../_lib/auth");

module.exports = async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const user = await requireUser(req);

    const {
      currentPassword,
      newPassword,
    } = req.body || {};

    if (
      typeof currentPassword !== "string" ||
      !currentPassword
    ) {
      return res.status(400).json({
        error:
          "Current password is required",
      });
    }

    if (
      typeof newPassword !== "string" ||
      newPassword.length < 6
    ) {
      return res.status(400).json({
        error:
          "New password must be at least 6 characters long",
      });
    }

    const dbUser =
      await prisma.user.findUnique({
        where: {
          id: user.id,
        },
      });

    if (!dbUser) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const valid =
      await bcrypt.compare(
        currentPassword,
        dbUser.passwordHash
      );

    if (!valid) {
      return res.status(401).json({
        error: "Current password is incorrect",
      });
    }

    const newPasswordHash =
      await bcrypt.hash(
        newPassword,
        10
      );

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return res.status(200).json({
      ok: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error(
      "[web-auth/change-password]",
      error
    );

    const status =
      error.statusCode || 500;

    return res.status(status).json({
      error:
        error.message ||
        "Unable to change password",
    });
  }
};