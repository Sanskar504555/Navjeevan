const { prisma } = require("../_lib/prisma");
const { requireAdmin } = require("../_lib/auth");

// Restoring replaces every current patient and prescription with the
// snapshot's contents — deliberately all-or-nothing (like restoring the
// desktop app's SQLite file), not a merge. The frontend gates this behind
// a confirmation dialog before calling it.

module.exports = async function handler(req, res) {
  try {
    await requireAdmin(req);

    const { id } = req.query;
    const backupId = String(id || "").trim();

    if (!backupId) {
      return res.status(400).json({
        error: "Backup id is required",
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    const backup = await prisma.backup.findUnique({ where: { id: backupId } });

    if (!backup) {
      return res.status(404).json({
        error: "Backup not found",
      });
    }

    const patients = Array.isArray(backup.data?.patients) ? backup.data.patients : [];
    const prescriptions = Array.isArray(backup.data?.prescriptions) ? backup.data.prescriptions : [];

    await prisma.$transaction(async (tx) => {
      // Deleting patients cascades their prescriptions (see schema.prisma).
      await tx.patient.deleteMany({});

      if (patients.length) {
        await tx.patient.createMany({
          data: patients.map((p) => ({
            patientId: String(p.id),
            fullName: String(p.patientName || "Unnamed"),
            data: p,
          })),
        });
      }

      if (prescriptions.length) {
        await tx.prescription.createMany({
          data: prescriptions.map((rx) => ({
            rxId: String(rx.id),
            patientId: String(rx.patientId),
            data: rx,
          })),
        });
      }
    });

    return res.status(200).json({
      restored: true,
      patientCount: patients.length,
      prescriptionCount: prescriptions.length,
    });
  } catch (error) {
    console.error("[web/backups/:id]", error);

    const status = error.statusCode || 500;

    return res.status(status).json({
      error: error.message || "Restore failed",
    });
  }
};
