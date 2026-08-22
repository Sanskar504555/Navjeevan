const path = require("path");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

// In local/Vercel development, explicitly load the project-root .env before
// Prisma is instantiated. Production Vercel uses its configured env vars.
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });
}

const globalForPrisma = global;
const prisma = globalForPrisma.__navjeevan_prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__navjeevan_prisma = prisma;
}
module.exports = { prisma };
