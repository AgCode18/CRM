import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { acceptInvitation } from "../controllers/team-invitation.controller.js";

const router = Router();

router.post("/accept", asyncHandler(acceptInvitation));

export default router;