const { prisma } = require("../_lib/prisma");
const { requireAdmin } = require("../_lib/auth");

const MAX_BACKUPS = 30;

// Web equivalent of the desktop app's local SQLite snapshots: a full
// point-in-time copy of every patient and prescription, stored as one row.
// Manually triggered only (no automatic on-launch/6-hourly snapshot here —
// each one duplicates every patient record, so unlike a local SQLite file
// copy this isn't free; leaving it to "Back Up Now" keeps the table bounded
// and predictable).

module.exports = async function handler(req, res) {
  try {
    await requireAdmin(req);

    // ==========================================================
    // LIST BACKUPS (metadata only — not the full snapshot data)
    // ==========================================================

    if (req.method === "GET") {
      const rows = await prisma.backup.findMany({
        orderBy: { createdAt: "desc" },
        take: MAX_BACKUPS,
        select: { id: true, createdAt: true, data: true },
      });

      return res.status(200).json({
        backups: rows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
          patientCount: Array.isArray(row.data?.patients) ? row.data.patients.length : 0,
        })),
      });
    }

    // ==========================================================
    // CREATE BACKUP
    // ==========================================================

    if (req.method === "POST") {
      const [patients, prescriptions] = await Promise.all([
        prisma.patient.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.prescription.findMany({ orderBy: { createdAt: "asc" } }),
      ]);

      const created = await prisma.backup.create({
        data: {
          data: {
            patients: patients.map((p) => p.data),
            prescriptions: prescriptions.map((p) => p.data),
          },
        },
      });

      // Prune anything beyond the most recent MAX_BACKUPS.
      const stale = await prisma.backup.findMany({
        orderBy: { createdAt: "desc" },
        skip: MAX_BACKUPS,
        select: { id: true },
      });
      if (stale.length) {
        await prisma.backup.deleteMany({ where: { id: { in: stale.map((b) => b.id) } } });
      }

      return res.status(201).json({
        backup: { id: created.id, createdAt: created.createdAt, patientCount: patients.length },
      });
    }

    return res.status(405).json({
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("[web/backups]", error);

    const status = error.statusCode || 500;

    return res.status(status).json({
      error: error.message || "Backup request failed",
    });
  }
};
