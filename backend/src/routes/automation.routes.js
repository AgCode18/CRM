
import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrganization } from "../middleware/organization.middleware.js";

import {
    createRule,
    getRules,
    getRule,
    updateRule,
    toggleRule,
    removeRule,
    getExecutions,
} from "../controllers/automation.controller.js";

const router = Router();

async function requireAutomationManager(req, res, next) {
    try {
        const membership = await prisma.organizationMembership.findFirst({
            where: {
                organizationId: req.organization.id,
                userId: req.user.id,
            },
            select: { role: true },
        });

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: "Organization membership required.",
            });
        }

        if (!["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to manage automations.",
            });
        }

        next();
    } catch (error) {
        next(error);
    }
}

router.use(authenticate, requireOrganization, requireAutomationManager);

router.post("/", createRule);
router.get("/", getRules);
router.get("/executions", getExecutions);

router.get("/:ruleId", getRule);
router.patch("/:ruleId", updateRule);
router.patch("/:ruleId/toggle", toggleRule);
router.delete("/:ruleId", removeRule);

export default router;
