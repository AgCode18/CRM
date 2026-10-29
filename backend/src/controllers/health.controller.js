import prisma from "../config/prisma.js";
import { asyncHandler } from "../utils/async.handler.js";

export const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    message: "CRM API is running",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
};

export const getReadiness = asyncHandler(async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;

  res.status(200).json({
    success: true,
    message: "API and database are ready",
    database: "connected",
    timestamp: new Date().toISOString(),
  });
});