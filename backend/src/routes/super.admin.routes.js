
import { Router } from "express";
import { asyncHandler } from "../utils/async.handler.js";
import { requireSuperAdmin } from "../middleware/super.admin.middleware.js";

import {
    superAdminLogin,
    superAdminDashboard,
    superAdminOrganizations,
    superAdminOrganizationDetails,
    superAdminUpdateOrganizationStatus,
    superAdminUsers,
    superAdminAuditLogs
} from "../controllers/super.admin.controller.js";


const router = Router();

// Public endpoint, but only existing SUPER_ADMIN accounts can log in.
router.post("/login", asyncHandler(superAdminLogin));

// All routes below require verified Super Admin access.
router.use(requireSuperAdmin);

router.get("/audit-logs", asyncHandler(superAdminAuditLogs));

router.get("/dashboard", asyncHandler(superAdminDashboard));

router.get("/organizations", asyncHandler(superAdminOrganizations));

router.get(
    "/organizations/:id",
    asyncHandler(superAdminOrganizationDetails)
);

router.patch(
    "/organizations/:id/status",
    asyncHandler(superAdminUpdateOrganizationStatus)
);

router.get("/users", asyncHandler(superAdminUsers));

export default router;
