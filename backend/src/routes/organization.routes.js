
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
    requireOrganization,
} from "../middleware/organization.middleware.js";
import {
    allowRoles,
} from "../middleware/role.middleware.js";

const router = Router();

// All routes below require a valid login and organization membership.
router.use(authenticate, requireOrganization);

// GET /api/v1/organization/me
router.get("/me", (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            organization: req.organization,
        },
    });
});

// Example: only OWNER and ADMIN can access this route.
router.get(
    "/admin-check",
    allowRoles("OWNER", "ADMIN"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Permission verified",
        });
    }
);

export default router;
