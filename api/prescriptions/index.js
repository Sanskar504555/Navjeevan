const { prisma } = require("../_lib/prisma");
const { requireUser } = require("../_lib/auth");

// Prescriptions produced by PrescriptionModal (renderer/src/App.jsx) are
// stored as-is in the `data` JSON column, same as Patient.data. `rxId` is
// the client-generated `id` from the modal — kept as the lookup key so the
// frontend never has to remap ids after a save.

module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);

    // ==========================================================
    // LIST PRESCRIPTIONS
    // ==========================================================

    if (req.method === "GET") {
      const rows = await prisma.prescription.findMany({
        orderBy: { createdAt: "asc" },
      });

      return res.status(200).json({
        prescriptions: rows.map((row) => row.data),
      });
    }

    // ==========================================================
    // CREATE PRESCRIPTION
    // ==========================================================

    if (req.method === "POST") {
      const payload = req.body || {};

      const rxId = String(payload.id || "").trim();
      const patientId = String(payload.patientId || "").trim();

      if (!rxId) {
        return res.status(400).json({
          error: "Prescription is missing an id",
        });
      }

      if (!patientId) {
        return res.status(400).json({
          error: "Prescription is missing a patient id",
        });
      }

      const created = await prisma.prescription.create({
        data: {
          rxId,
          patientId,
          data: payload,
        },
      });

      return res.status(201).json({
        prescription: created.data,
      });
    }

    return res.status(405).json({
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("[web/prescriptions]", error);

    const status = error.statusCode || 500;

    return res.status(status).json({
      error: error.message || "Prescription request failed",
    });
  }
};
