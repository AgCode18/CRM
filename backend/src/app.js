import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import { notFound } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";

import authRoutes from "./routes/auth.routes.js";
import organizationRoutes from "./routes/organization.routes.js"
import roleRoutes from "./routes/role.routes.js";
import leadRoutes from "./routes/lead.routes.js";
import superAdminRoutes from "./routes/super-admin.routes.js";




const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true,
    })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use(
    "/api",
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 300,
        standardHeaders: true,
        legacyHeaders: false,
    })
);

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "CRM API",
        version: "1.0.0",
    });
});

app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/organization", organizationRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/leads", leadRoutes);
app.use("/api/v1/super-admin", superAdminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;