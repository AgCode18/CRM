
import prisma from "../config/prisma.js";

const VALID_ACTIONS = [
    "SUPER_ADMIN_LOGIN",
    "ORGANIZATION_SUSPENDED",
    "ORGANIZATION_ACTIVATED",
];

function parsePagination(query = {}) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(query.limit, 10) || 20)
    );

    return {
        page,
        limit,
        skip: (page - 1) * limit,
    };
}

function buildFilters(query = {}) {
    const where = {};

    if (query.action) {
        if (!VALID_ACTIONS.includes(query.action)) {
            const error = new Error("Invalid audit action.");
            error.statusCode = 400;
            throw error;
        }

        where.action = query.action;
    }

    if (query.from || query.to) {
        where.createdAt = {};

        if (query.from) {
            const from = new Date(query.from);

            if (Number.isNaN(from.getTime())) {
                const error = new Error("Invalid 'from' date.");
                error.statusCode = 400;
                throw error;
            }

            where.createdAt.gte = from;
        }

        if (query.to) {
            const to = new Date(query.to);

            if (Number.isNaN(to.getTime())) {
                const error = new Error("Invalid 'to' date.");
                error.statusCode = 400;
                throw error;
            }

            where.createdAt.lte = to;
        }
    }

    return where;
}

/**
 * Reusable audit writer for other modules.
 * Never pass passwords, tokens, or other secrets in metadata.
 */
export async function recordAuditLog({
    action,
    description,
    actorId = null,
    organizationId = null,
    metadata = undefined,
}) {
    if (!VALID_ACTIONS.includes(action)) {
        throw new Error(`Unsupported audit action: ${action}`);
    }

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

/**
 * Platform-wide logs. Only call this from Super Admin-protected routes.
 */
export async function listPlatformAuditLogs(query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const where = buildFilters(query);

    if (query.organizationId) {
        where.organizationId = query.organizationId;
    }

    if (query.actorId) {
        where.actorId = query.actorId;
    }

    const [logs, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                actor: {
                    select: { id: true, name: true, email: true },
                },
                organization: {
                    select: { id: true, name: true },
                },
            },
        }),
        prisma.auditLog.count({ where }),
    ]);

    return {
        data: logs,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

/**
 * Organization logs. Only OWNER and ADMIN can view these.
 */
export async function listOrganizationAuditLogs({
    userId,
    organizationId,
    role,
    query = {},
}) {
    if (!userId || !organizationId) {
        const error = new Error("User and organization are required.");
        error.statusCode = 400;
        throw error;
    }

    // Verify membership in the database instead of trusting a client-supplied role.
    const membership = await prisma.organizationMembership.findFirst({
        where: { userId, organizationId },
        select: { role: true },
    });

    if (
        !membership ||
        !["OWNER", "ADMIN"].includes(membership.role)
    ) {
        const error = new Error(
            "Only organization owners and admins can view audit logs."
        );
        error.statusCode = 403;
        throw error;
    }

    const { page, limit, skip } = parsePagination(query);
    const where = {
        ...buildFilters(query),
        organizationId,
    };

    if (query.actorId) {
        where.actorId = query.actorId;
    }

    const [logs, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                actor: {
                    select: { id: true, name: true, email: true },
                },
            },
        }),
        prisma.auditLog.count({ where }),
    ]);

    return {
        data: logs,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
