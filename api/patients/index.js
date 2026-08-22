const { prisma } = require("../_lib/prisma");
const { requireUser } = require("../_lib/auth");

// The registration form (renderer/src/App.jsx -> blankPatient()) produces a
// large nested object (history, exam, hormone panels, husband's semen
// analysis, treatment cycles, etc). Rather than reshape that into relational
// columns, the complete object is stored as-is in the `data` JSON column.
// `patientId` below is the client-generated `id` from blankPatient()/uid() —
// keeping it as the lookup key means the frontend never has to remap ids
// after a save.

module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);

    // ==========================================================
    // LIST PATIENTS
    // ==========================================================

    if (req.method === "GET") {
      const rows = await prisma.patient.findMany({
        orderBy: { createdAt: "asc" },
      });

      return res.status(200).json({
        patients: rows.map((row) => row.data),
      });
    }

    // ==========================================================
    // CREATE PATIENT
    // ==========================================================

    if (req.method === "POST") {
      const payload = req.body || {};

      const clientId = String(payload.id || "").trim();
      const fullName = String(payload.patientName || "").trim();

      if (!clientId) {
        return res.status(400).json({
          error: "Patient record is missing an id",
        });
      }

      if (!fullName) {
        return res.status(400).json({
          error: "Patient name is required",
        });
      }

      const existing = await prisma.patient.findUnique({
        where: { patientId: clientId },
      });

      if (existing) {
        return res.status(409).json({
          error: "A patient with this id already exists",
        });
      }

      const created = await prisma.patient.create({
        data: {
          patientId: clientId,
          fullName,
          data: payload,
        },
      });

      return res.status(201).json({
        patient: created.data,
      });
    }

    return res.status(405).json({
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("[web/patients]", error);

    const status = error.statusCode || 500;

    return res.status(status).json({
      error: error.message || "Patient request failed",
    });
  }
};
