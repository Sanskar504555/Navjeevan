const { prisma } = require("./prisma");

// File No. lives inside the `data` JSON column (see api/patients/index.js),
// so uniqueness can't be a DB constraint. The client checks its own loaded
// patient list first, but that list can be stale when another PC registered
// a patient after this one logged in — so the API checks again here. Matching
// mirrors the client: trimmed, case-insensitive.
async function findFileNoDuplicate(fileNo, excludePatientId) {
  const value = String(fileNo || "").trim();
  if (!value) return null;

  const rows = await prisma.$queryRaw`
    SELECT data FROM patients
    WHERE lower(trim(data->>'fileNo')) = lower(${value})
      AND patient_id <> ${String(excludePatientId || "")}
    LIMIT 1
  `;

  return rows.length ? rows[0].data : null;
}

function sendFileNoDuplicate(res, fileNo, duplicate) {
  return res.status(409).json({
    error: `Patient already registered with File No. ${String(fileNo).trim()} (${duplicate.patientName || "unnamed"}).`,
    duplicate,
  });
}

module.exports = { findFileNoDuplicate, sendFileNoDuplicate };
