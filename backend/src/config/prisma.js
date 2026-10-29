import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from backend/.env");
}

const databaseUrl = new URL(process.env.DATABASE_URL);

if (databaseUrl.protocol !== "mysql:") {
  throw new Error("DATABASE_URL must use mysql://");
}

const databaseName = decodeURIComponent(
  databaseUrl.pathname.slice(1)
);

if (!databaseUrl.hostname || !databaseUrl.username || !databaseName) {
  throw new Error("DATABASE_URL must include host, username and database");
}

const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseName,
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

export default prisma;