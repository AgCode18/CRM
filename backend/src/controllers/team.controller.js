
import { z } from "zod";
import {
    listTeamMembers,
    updateTeamMemberRole,
    removeTeamMember,
} from "../services/team.service.js";

const roleSchema = z.object({
    role: z.enum(["ADMIN", "MANAGER", "SALES_REP"]),
});

export async function getTeamMembers(req, res) {
    const members = await listTeamMembers(
        req.organization.id,
        req.user.id
    );

    res.json({
        success: true,
        data: members,
    });
}

export async function changeTeamMemberRole(req, res) {
    const parsed = roleSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid role",
            errors: parsed.error.flatten(),
        });
    }

    const member = await updateTeamMemberRole({
        organizationId: req.organization.id,
        actorId: req.user.id,
        targetUserId: req.params.userId,
        newRole: parsed.data.role,
    });

    res.json({
        success: true,
        message: "Team member role updated",
        data: member,
    });
}

export async function deleteTeamMember(req, res) {
    const result = await removeTeamMember({
        organizationId: req.organization.id,
        actorId: req.user.id,
        targetUserId: req.params.userId,
    });

    res.json({
        success: true,
        message: "Team member removed",
        data: result,
    });
}
