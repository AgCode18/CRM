
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrganization } from "../middleware/organization.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

import {
    createLeadController,
    listLeadsController,
    getLeadController,
    updateLeadController,
    deleteLeadController,
} from "../controllers/lead.controller.js";

const router = Router();

router.use(authenticate, requireOrganization);

// Any organization member can view and create leads.
router.post("/", asyncHandler(createLeadController));
router.get("/", asyncHandler(listLeadsController));
router.get("/:id", asyncHandler(getLeadController));
router.patch("/:id", asyncHandler(updateLeadController));

// Only OWNER, ADMIN and MANAGER can delete leads.
router.delete(
    "/:id",
    allowRoles("OWNER", "ADMIN", "MANAGER"),
    asyncHandler(deleteLeadController)
);

export default router;
