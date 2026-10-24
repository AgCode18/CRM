
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrganization } from "../middleware/organization.middleware.js";
import {
    allowRoles,
    requireMinimumRole,
} from "../middleware/role.middleware.js";

const router = Router();

// All routes require login and organization membership.
router.use(authenticate, requireOrganization);

// GET /api/v1/roles/me
// Any organization member can view their own role.
router.get("/me", (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            userId: req.user.id,
            organizationId: req.organization.id,
            role: req.organization.role,
        },
    });
});

// GET /api/v1/roles
// OWNER and ADMIN can access role-management information.
router.get(
    "/",
    allowRoles("OWNER", "ADMIN"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "You can access role management",
            availableRoles: [
                "OWNER",
                "ADMIN",
                "MANAGER",
                "SALES_REP",
            ],
        });
    }
);

// Example protected route for higher-level permissions.
router.get(
    "/admin-check",
    requireMinimumRole("ADMIN"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Admin-level permission verified",
        });
    }
);

export default router;
