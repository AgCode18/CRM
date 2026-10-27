
import { Router } from "express";
import { getOrganizationAuditLogs } from "../controllers/audit-log.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrganization } from "../middleware/organization.middleware.js";

const router = Router();

router.get(
    "/",
    authenticate,
    requireOrganization,
    getOrganizationAuditLogs
);

export default router;
