import { Router } from "express";

import { asyncHandler } from "../utils/async-handler.js";
import { requireOrganization } from "../middleware/organization.middleware.js";

import {
    getContacts,
    getContact,
    postContact,
    patchContact,
    removeContact,
} from "../controllers/contact.controller.js";

const router = Router();

// Authentication, organization membership and suspension checks.
router.use(requireOrganization);

router.get("/", asyncHandler(getContacts));
router.get("/:id", asyncHandler(getContact));
router.post("/", asyncHandler(postContact));
router.patch("/:id", asyncHandler(patchContact));
router.delete("/:id", asyncHandler(removeContact));

export default router;