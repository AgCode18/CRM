
import { Router } from "express";
import {
    getActivities,
    getActivityById,
    postActivity,
    removeActivity,
    getActivitySummary,
} from "../controllers/activity.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrganization } from "../middleware/organization.middleware.js";

const router = Router();

router.use(authenticate, requireOrganization);

// Keep the static route before /:id.
router.get("/summary", getActivitySummary);
router.get("/", getActivities);
router.post("/", postActivity);
router.get("/:id", getActivityById);
router.delete("/:id", removeActivity);

export default router;
