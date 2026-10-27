
import prisma from "../config/prisma.js";

const taskSelect = {
    id: true,
    title: true,
    description: true,
    status: true,
    dueDate: true,
    organizationId: true,
    assignedToId: true,
    createdAt: true,
    updatedAt: true,
    assignedTo: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
};

const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"];

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function validateStatus(status) {
    if (status !== undefined && !TASK_STATUSES.includes(status)) {
        throw httpError(400, "Invalid task status.");
    }
}

async function validateAssignee(organizationId, assignedToId) {
    if (assignedToId === null || assignedToId === undefined) {
        return;
    }

    const membership = await prisma.organizationMembership.findFirst({
        where: {
            organizationId,
            userId: assignedToId,
        },
        select: { id: true },
    });

    if (!membership) {
        throw httpError(
            400,
            "Assigned user must belong to this organization."
        );
    }
}

async function getMembership(organizationId, userId) {
    const membership = await prisma.organizationMembership.findFirst({
        where: { organizationId, userId },
        select: { role: true },
    });

    if (!membership) {
        throw httpError(403, "You are not a member of this organization.");
    }

    return membership;
}

async function getTaskOrThrow(organizationId, taskId) {
    const task = await prisma.task.findFirst({
        where: {
            id: taskId,
            organizationId,
        },
        select: taskSelect,
    });

    if (!task) {
        throw httpError(404, "Task not found.");
    }

    return task;
}

function parseDate(value) {
    if (value === null) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw httpError(400, "Invalid due date.");
    }

    return date;
}

// GET /api/v1/tasks
export async function listTasks(organizationId, query = {}) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(query.limit, 10) || 20)
    );

    const where = { organizationId };

    if (query.status) {
        validateStatus(query.status);
        where.status = query.status;
    }

    if (query.assignedToId) {
        where.assignedToId = query.assignedToId;
    }

    if (query.search) {
        where.OR = [
            { title: { contains: query.search } },
            { description: { contains: query.search } },
        ];
    }

    if (query.due === "overdue") {
        where.dueDate = { lt: new Date() };
        where.status = { not: "COMPLETED" };
    } else if (query.due === "upcoming") {
        where.dueDate = { gte: new Date() };
        where.status = { not: "COMPLETED" };
    }

    const [tasks, total] = await prisma.$transaction([
        prisma.task.findMany({
            where,
            select: taskSelect,
            orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.task.count({ where }),
    ]);

    return {
        tasks,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// GET /api/v1/tasks/:id
export async function getTask(organizationId, taskId) {
    return getTaskOrThrow(organizationId, taskId);
}

// POST /api/v1/tasks
export async function createTask(organizationId, userId, data) {
    await getMembership(organizationId, userId);
    validateStatus(data.status);

    if (data.assignedToId !== undefined) {
        await validateAssignee(organizationId, data.assignedToId);
    }

    return prisma.task.create({
        data: {
            title: data.title,
            description: data.description ?? null,
            status: data.status ?? "PENDING",
            dueDate:
                data.dueDate === undefined ? null : parseDate(data.dueDate),
            organizationId,
            assignedToId: data.assignedToId ?? null,
        },
        select: taskSelect,
    });
}

// PATCH /api/v1/tasks/:id
export async function updateTask(
    organizationId,
    userId,
    taskId,
    data
) {
    const membership = await getMembership(organizationId, userId);
    const existing = await getTaskOrThrow(organizationId, taskId);

    const isManager = ["OWNER", "ADMIN", "MANAGER"].includes(
        membership.role
    );

    // Sales representatives can update their own tasks only.
    if (!isManager && existing.assignedToId !== userId) {
        throw httpError(403, "You can update only tasks assigned to you.");
    }

    validateStatus(data.status);

    if (data.assignedToId !== undefined) {
        if (!isManager) {
            throw httpError(403, "Only managers can reassign tasks.");
        }

        await validateAssignee(organizationId, data.assignedToId);
    }

    const updateData = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) {
        updateData.description = data.description;
    }
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) {
        updateData.dueDate = parseDate(data.dueDate);
    }
    if (data.assignedToId !== undefined) {
        updateData.assignedToId = data.assignedToId;
    }

    return prisma.task.update({
        where: { id: existing.id },
        data: updateData,
        select: taskSelect,
    });
}

// DELETE /api/v1/tasks/:id
export async function deleteTask(organizationId, userId, taskId) {
    const membership = await getMembership(organizationId, userId);
    await getTaskOrThrow(organizationId, taskId);

    if (!["OWNER", "ADMIN"].includes(membership.role)) {
        throw httpError(403, "Only owners and admins can delete tasks.");
    }

    await prisma.task.delete({
        where: { id: taskId },
    });

    return { message: "Task deleted successfully." };
}

// GET /api/v1/tasks/summary
export async function getTaskSummary(organizationId, userId) {
    await getMembership(organizationId, userId);

    const now = new Date();

    const [pending, inProgress, completed, overdue, upcoming] =
        await Promise.all([
            prisma.task.count({
                where: { organizationId, status: "PENDING" },
            }),
            prisma.task.count({
                where: { organizationId, status: "IN_PROGRESS" },
            }),
            prisma.task.count({
                where: { organizationId, status: "COMPLETED" },
            }),
            prisma.task.count({
                where: {
                    organizationId,
                    status: { not: "COMPLETED" },
                    dueDate: { lt: now },
                },
            }),
            prisma.task.count({
                where: {
                    organizationId,
                    status: { not: "COMPLETED" },
                    dueDate: { gte: now },
                },
            }),
        ]);

    return { pending, inProgress, completed, overdue, upcoming };
}
