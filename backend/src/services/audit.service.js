
import prisma from "../config/prisma.js";

export async function createAuditLog({
    action,
    description,
    actorId = null,
    organizationId = null,
    metadata = undefined,
}) {
    return prisma.auditLog.create({
        data: {
            action,
            description,
            actorId,
            organizationId,
            ...(metadata !== undefined ? { metadata } : {}),
        },
    });
}
