const { prisma } = require("../_lib/prisma");
const { requireUser } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  try {
    await requireUser(req);

    const { id } = req.query;
    const rxId = String(id || "").trim();

    if (!rxId) {
      return res.status(400).json({
        error: "Prescription id is required",
      });
    }

    // ==========================================================
    // UPDATE PRESCRIPTION
    // ==========================================================

    if (req.method === "PUT") {
      const payload = req.body || {};
      const patientId = String(payload.patientId || "").trim();

      if (!patientId) {
        return res.status(400).json({
          error: "Prescription is missing a patient id",
        });
      }

      const updated = await prisma.prescription.update({
        where: { rxId },
        data: { patientId, data: payload },
      });

      return res.status(200).json({
        prescription: updated.data,
      });
    }

    // ==========================================================
    // DELETE PRESCRIPTION
    // ==========================================================

    if (req.method === "DELETE") {
      await prisma.prescription
        .delete({ where: { rxId } })
        .catch((error) => {
          // Idempotent delete: already gone is not a failure.
          if (error.code !== "P2025") throw error;
        });

      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("[web/prescriptions/:id]", error);

    const status = error.statusCode || 500;

    return res.status(status).json({
      error: error.message || "Prescription request failed",
    });
  }
};
