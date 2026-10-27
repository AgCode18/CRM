
import prisma from "../config/prisma.js";

const activitySelect = {
    id: true,
    type: true,
    description: true,
    organizationId: true,
    userId: true,
    createdAt: true,
    user: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
};

const ACTIVITY_TYPES = [
    "NOTE",
    "CALL",
    "EMAIL",
    "MEETING",
    "STATUS_CHANGE",
];

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function requireMembership(organizationId, userId) {
    const membership = await prisma.organizationMembership.findFirst({
        where: { organizationId, userId },
        select: { role: true },
    });

    if (!membership) {
        throw httpError(403, "You are not a member of this organization.");
    }

    return membership;
}

// GET /api/v1/activities
export async function listActivities(organizationId, query = {}) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(query.limit, 10) || 20)
    );

    const where = { organizationId };

    if (query.type) {
        if (!ACTIVITY_TYPES.includes(query.type)) {
            throw httpError(400, "Invalid activity type.");
        }

        where.type = query.type;
    }

    if (query.userId) {
        where.userId = query.userId;
    }

    if (query.search) {
        where.description = { contains: query.search };
    }

    const [activities, total] = await prisma.$transaction([
        prisma.activity.findMany({
            where,
            select: activitySelect,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.activity.count({ where }),
    ]);

    return {
        activities,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// GET /api/v1/activities/:id
export async function getActivity(organizationId, activityId) {
    const activity = await prisma.activity.findFirst({
        where: { id: activityId, organizationId },
        select: activitySelect,
    });

    if (!activity) {
        throw httpError(404, "Activity not found.");
    }

    return activity;
}

// POST /api/v1/activities
export async function createActivity(organizationId, userId, data) {
    await requireMembership(organizationId, userId);

    return prisma.activity.create({
        data: {
            type: data.type ?? "NOTE",
            description: data.description,
            organizationId,
            userId,
        },
        select: activitySelect,
    });
}

// DELETE /api/v1/activities/:id
export async function deleteActivity(
    organizationId,
    userId,
    activityId
) {
    const membership = await requireMembership(organizationId, userId);
    const activity = await getActivity(organizationId, activityId);

    const canDelete =
        ["OWNER", "ADMIN"].includes(membership.role) ||
        activity.userId === userId;

    if (!canDelete) {
        throw httpError(
            403,
            "You can delete only your own activities unless you are an owner or admin."
        );
    }

    await prisma.activity.delete({
        where: { id: activityId },
    });

    return { message: "Activity deleted successfully." };
}

// GET /api/v1/activities/summary
export async function getActivitySummary(organizationId, userId) {
    await requireMembership(organizationId, userId);

    const groups = await prisma.activity.groupBy({
        by: ["type"],
        where: { organizationId },
        _count: { _all: true },
    });

    const total = groups.reduce((sum, group) => sum + group._count._all, 0);

    return {
        total,
        byType: Object.fromEntries(
            groups.map((group) => [group.type, group._count._all])
        ),
    };
}
