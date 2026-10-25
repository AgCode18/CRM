
import prisma from "../config/prisma.js";

const MANAGEABLE_ROLES = ["MANAGER", "SALES_REP"];
const OWNER_ASSIGNABLE_ROLES = ["ADMIN", "MANAGER", "SALES_REP"];

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function getActorMembership(organizationId, actorId) {
    const membership = await prisma.organizationMembership.findFirst({
        where: {
            organizationId,
            userId: actorId,
        },
        select: {
            id: true,
            role: true,
            userId: true,
        },
    });

    if (!membership) {
        throw httpError(403, "You are not a member of this organization");
    }

    return membership;
}

export async function listTeamMembers(organizationId, actorId) {
    await getActorMembership(organizationId, actorId);

    const members = await prisma.organizationMembership.findMany({
        where: { organizationId },
        orderBy: { createdAt: "asc" },
        select: {
            id: true,
            role: true,
            createdAt: true,
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    return members;
}

export async function updateTeamMemberRole({
    organizationId,
    actorId,
    targetUserId,
    newRole,
}) {
    const actor = await getActorMembership(organizationId, actorId);

    if (!["OWNER", "ADMIN"].includes(actor.role)) {
        throw httpError(403, "You do not have permission to manage team roles");
    }

    if (targetUserId === actorId) {
        throw httpError(400, "You cannot change your own role here");
    }

    const target = await prisma.organizationMembership.findFirst({
        where: { organizationId, userId: targetUserId },
    });

    if (!target) {
        throw httpError(404, "Team member not found");
    }

    if (target.role === "OWNER") {
        throw httpError(403, "The owner role cannot be changed here");
    }

    if (actor.role === "ADMIN" && !MANAGEABLE_ROLES.includes(newRole)) {
        throw httpError(403, "Admins can only assign MANAGER or SALES_REP roles");
    }

    if (
        actor.role === "OWNER" &&
        !OWNER_ASSIGNABLE_ROLES.includes(newRole)
    ) {
        throw httpError(400, "Invalid role for this operation");
    }

    return prisma.organizationMembership.update({
        where: { id: target.id },
        data: { role: newRole },
        select: {
            id: true,
            role: true,
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });
}

export async function removeTeamMember({
    organizationId,
    actorId,
    targetUserId,
}) {
    const actor = await getActorMembership(organizationId, actorId);

    if (!["OWNER", "ADMIN"].includes(actor.role)) {
        throw httpError(403, "You do not have permission to remove team members");
    }

    if (targetUserId === actorId) {
        throw httpError(400, "You cannot remove yourself using this endpoint");
    }

    const target = await prisma.organizationMembership.findFirst({
        where: { organizationId, userId: targetUserId },
    });

    if (!target) {
        throw httpError(404, "Team member not found");
    }

    if (target.role === "OWNER") {
        throw httpError(403, "The organization owner cannot be removed");
    }

    if (actor.role === "ADMIN" && target.role === "ADMIN") {
        throw httpError(403, "Admins cannot remove other admins");
    }

    await prisma.organizationMembership.delete({
        where: { id: target.id },
    });

    return { removedUserId: targetUserId };
}
