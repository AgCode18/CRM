
import { Router } from "express";
import { asyncHandler } from "../utils/async.handler.js";
import { requireOrganization } from "../middleware/organization.middleware.js";
import {
    getLeads,
    getLead,
    postLead,
    patchLead,
    removeLead,
} from "../controllers/lead.controller.js";

import { convertLead } from "../controllers/lead.conversion.controller.js";

const router = Router();

router.use(requireOrganization);

router.get("/", asyncHandler(getLeads));
router.get("/:id", asyncHandler(getLead));
router.post("/", asyncHandler(postLead));
router.patch("/:id", asyncHandler(patchLead));
router.delete("/:id", asyncHandler(removeLead));
router.post("/:leadId/convert", authenticate, requireOrganization, convertLead);

export default router;
