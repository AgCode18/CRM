import "dotenv/config";

const port = Number(process.env.PORT || 4000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid port number");
}

if (!process.env.FRONTEND_URL) {
  throw new Error("FRONTEND_URL is missing from backend/.env");
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: port,
  FRONTEND_URL: process.env.FRONTEND_URL,
};