import app from "./app.js";
import prisma from "./config/prisma.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
    console.log(`CRM API running at http://localhost:${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
});

let shuttingDown = false;

async function shutdown(signal) {
    if (shuttingDown) return;

    shuttingDown = true;
    console.log(`${signal} received. Shutting down...`);

    server.close(async () => {
        try {
            await prisma.$disconnect();
            console.log("Database disconnected.");
            process.exitCode = 0;
        } catch (error) {
            console.error("Error disconnecting Prisma:", error);
            process.exitCode = 1;
        }
    });

    // Prevent the process from hanging indefinitely during shutdown.
    setTimeout(() => {
        console.error("Graceful shutdown timed out.");
        process.exit(1);
    }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));