const { prisma } = require("../_lib/prisma");
const { requireUser } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  try {
    await requireUser(req);

    const { id } = req.query;
    const patientId = String(id || "").trim();

    if (!patientId) {
      return res.status(400).json({
        error: "Patient id is required",
      });
    }

    // ==========================================================
    // GET ONE PATIENT
    // ==========================================================

    if (req.method === "GET") {
      const row = await prisma.patient.findUnique({
        where: { patientId },
      });

      if (!row) {
        return res.status(404).json({
          error: "Patient not found",
        });
      }

      return res.status(200).json({
        patient: row.data,
      });
    }

    // ==========================================================
    // UPDATE PATIENT
    // ==========================================================

    if (req.method === "PUT") {
      const payload = req.body || {};
      const fullName = String(payload.patientName || "").trim();

      // Upsert: the frontend always knows whether it's editing an existing
      // patient or registering a new one, but this stays resilient if a
      // record was never persisted (e.g. a retried request after a dropped
      // connection during the original create).
      const updated = await prisma.patient.upsert({
        where: { patientId },
        update: {
          fullName: fullName || undefined,
          data: payload,
        },
        create: {
          patientId,
          fullName: fullName || "Unnamed",
          data: payload,
        },
      });

      return res.status(200).json({
        patient: updated.data,
      });
    }

    // ==========================================================
    // DELETE PATIENT
    // ==========================================================

    if (req.method === "DELETE") {
      await prisma.patient
        .delete({ where: { patientId } })
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
    console.error("[web/patients/:id]", error);

    const status = error.statusCode || 500;

    return res.status(status).json({
      error: error.message || "Patient request failed",
    });
  }
};
