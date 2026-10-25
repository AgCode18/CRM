import { z } from "zod";
import {
    createTeamInvitation,
    listTeamInvitations,
    revokeTeamInvitation,
    acceptTeamInvitation,
} from "../services/team-invitation.service.js";

const createInvitationSchema = z.object({
    email: z.string().trim().email().max(191),
    role: z.enum(["ADMIN", "MANAGER", "SALES_REP"]),
});

const acceptInvitationSchema = z.object({
    token: z.string().length(64),
    name: z.string().trim().min(1).max(100),
    password: z.string().min(12).max(72),
});

export async function createInvitation(req, res) {
    const parsed = createInvitationSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid invitation details",
            errors: parsed.error.flatten(),
        });
    }

    const result = await createTeamInvitation({
        organizationId: req.organization.id,
        actorId: req.user.id,
        ...parsed.data,
    });

    // Temporary development-only token exposure until email delivery
    // is connected. Never return the raw token in production.
    const response = {
        success: true,
        message: "Invitation created",
        data: result.invitation,
    };

    if (process.env.NODE_ENV !== "production") {
        response.developmentToken = result.token;
    }

    res.status(201).json(response);
}

export async function getInvitations(req, res) {
    const invitations = await listTeamInvitations({
        organizationId: req.organization.id,
        actorId: req.user.id,
    });

    res.json({
        success: true,
        data: invitations,
    });
}

export async function revokeInvitation(req, res) {
    const result = await revokeTeamInvitation({
        organizationId: req.organization.id,
        actorId: req.user.id,
        invitationId: req.params.id,
    });

    res.json({
        success: true,
        message: "Invitation revoked",
        data: result,
    });
}

export async function acceptInvitation(req, res) {
    const parsed = acceptInvitationSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid invitation acceptance details",
            errors: parsed.error.flatten(),
        });
    }

    const result = await acceptTeamInvitation(parsed.data);

    res.json({
        success: true,
        message: "Invitation accepted. You can now sign in.",
        data: result,
    });
}