import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import { notFound } from "./middleware/not.found.js";
import { errorHandler } from "./middleware/error.handler.js";

import authRoutes from "./routes/auth.routes.js";
import organizationRoutes from "./routes/organization.routes.js"
import roleRoutes from "./routes/role.routes.js";
import leadRoutes from "./routes/lead.routes.js";
import superAdminRoutes from "./routes/super.admin.routes.js";
import teamRoutes from "./routes/team.routes.js"
import invitationRoutes from "./routes/invitation.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import dealRoutes from "./routes/deal.routes.js";
import taskRoutes from "./routes/task.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import auditLogRoutes from "./routes/auditlog.routes.js";
import automationRoutes from "./routes/automation.routes.js";



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
app.use("/api/v1/super-admin", superAdminRoutes);
app.use("/api/v1/organization", organizationRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/leads", leadRoutes);
app.use("/api/v1/team", teamRoutes);
app.use("/api/v1/invitations", invitationRoutes);
app.use("/api/v1/contacts", contactRoutes);
app.use("/api/v1/deals", dealRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/activities", activityRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/audit-logs", auditLogRoutes);
app.use("/api/v1/automations", automationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;