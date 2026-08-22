// File: src/patientService.js
const { prisma } = require("./lib/prisma");

/**
 * Creates a new patient in Supabase.
 */
async function createPatient({ patientId, fullName, age, gender, phone, email }) {
  if (!patientId || !fullName || age === undefined || !gender) {
    throw new Error("Missing required fields: patientId, fullName, age, gender");
  }

  // Validate Gender ENUM values
  const validGenders = ["MALE", "FEMALE", "OTHER"];
  const formattedGender = gender.toUpperCase();
  if (!validGenders.includes(formattedGender)) {
    throw new Error("Invalid gender. Expected MALE, FEMALE, or OTHER.");
  }

  const newPatient = await prisma.patient.create({
    data: {
      patientId: String(patientId).trim(),
      fullName: String(fullName).trim(),
      age: parseInt(age, 10),
      gender: formattedGender,
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim().toLowerCase() : null,
    },
  });

  return newPatient;
}

/**
 * Lists patients with optional search filtering by name or patient ID.
 */
async function listPatients(searchQuery = "") {
  const query = String(searchQuery).trim();

  const patients = await prisma.patient.findMany({
    where: query
      ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { patientId: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { reports: true } },
    },
  });

  return patients;
}

/**
 * Gets a single patient by ID with all associated test reports.
 */
async function getPatientById(id) {
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      reports: {
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: { id: true, fullName: true, role: true },
          },
        },
      },
    },
  });

  if (!patient) throw new Error("Patient not found");
  return patient;
}

/**
 * Creates a test report for a patient.
 */
async function createTestReport({ patientId, createdBy, testType, results = {}, status = "PENDING" }) {
  if (!patientId || !createdBy || !testType) {
    throw new Error("Missing required fields: patientId, createdBy, testType");
  }

  const report = await prisma.testReport.create({
    data: {
      patientId,
      createdBy,
      testType: String(testType).trim(),
      results: typeof results === "string" ? JSON.parse(results) : results,
      status: status.toUpperCase(),
    },
  });

  return report;
}

/**
 * Updates report status or test result JSON.
 */
async function updateTestReport(reportId, { results, status }) {
  const updateData = {};
  if (results !== undefined) updateData.results = typeof results === "string" ? JSON.parse(results) : results;
  if (status !== undefined) updateData.status = status.toUpperCase();

  const updatedReport = await prisma.testReport.update({
    where: { id: reportId },
    data: updateData,
  });

  return updatedReport;
}

module.exports = {
  createPatient,
  listPatients,
  getPatientById,
  createTestReport,
  updateTestReport,
};