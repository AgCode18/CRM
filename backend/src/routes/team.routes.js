
import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireOrganization } from "../middleware/organization.middleware.js";
import {
    getTeamMembers,
    changeTeamMemberRole,
    deleteTeamMember,
} from "../controllers/team.controller.js";
import { createInvitation, getInvitations, revokeInvitation } from "../controllers/team.invitation.controller.js";

const router = Router();

// Requires authentication, organization membership,
// and rejection of suspended organizations.
router.use(requireOrganization);

router.get("/members", asyncHandler(getTeamMembers));

router.patch(
    "/members/:userId/role",
    asyncHandler(changeTeamMemberRole)
);

router.delete(
    "/members/:userId",
    asyncHandler(deleteTeamMember)
);

router.post("/invitations", asyncHandler(createInvitation));
router.get("/invitations", asyncHandler(getInvitations));
router.delete("/invitations/:id", asyncHandler(revokeInvitation));

export default router;
