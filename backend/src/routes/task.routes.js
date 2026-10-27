
import { Router } from "express";
import {
    getTasks,
    getTaskById,
    postTask,
    patchTask,
    removeTask,
    getTaskSummary,
} from "../controllers/task.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrganization } from "../middleware/organization.middleware.js";

const router = Router();

router.use(authenticate, requireOrganization);

// Register static routes before /:id.
router.get("/summary", getTaskSummary);
router.get("/", getTasks);
router.post("/", postTask);
router.get("/:id", getTaskById);
router.patch("/:id", patchTask);
router.delete("/:id", removeTask);

export default router;
