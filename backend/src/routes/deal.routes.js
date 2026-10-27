
import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireOrganization } from "../middleware/organization.middleware.js";

import {
    getDeals,
    getDeal,
    postDeal,
    patchDeal,
    removeDeal,
    getPipelineSummary,
} from "../controllers/deal.controller.js";

const router = Router();

router.use(requireOrganization);

// Keep this route before "/:id".
router.get("/pipeline-summary", asyncHandler(getPipelineSummary));

router.get("/", asyncHandler(getDeals));
router.get("/:id", asyncHandler(getDeal));
router.post("/", asyncHandler(postDeal));
router.patch("/:id", asyncHandler(patchDeal));
router.delete("/:id", asyncHandler(removeDeal));

export default router;
