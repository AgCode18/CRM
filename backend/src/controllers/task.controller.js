
import { z } from "zod";
import * as taskService from "../services/task.service.js";

const taskSchema = z.object({
    title: z.string().trim().min(1).max(191),
    description: z.string().max(5000).nullable().optional(),
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
    dueDate: z.string().datetime().nullable().optional(),
    assignedToId: z.string().min(1).nullable().optional(),
}).strict();

const updateTaskSchema = taskSchema.partial();

function sendError(res, error) {
    const status = error.status || 500;

    if (status === 500) {
        console.error("Task API error:", error);
    }

    return res.status(status).json({
        success: false,
        message: status === 500 ? "Internal server error." : error.message,
    });
}

function getContext(req) {
    return {
        organizationId: req.organization.id,
        userId: req.user.id,
    };
}

export async function getTasks(req, res) {
    try {
        const { organizationId } = getContext(req);
        const result = await taskService.listTasks(organizationId, req.query);

        return res.json({ success: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getTaskById(req, res) {
    try {
        const { organizationId } = getContext(req);
        const task = await taskService.getTask(organizationId, req.params.id);

        return res.json({ success: true, task });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function postTask(req, res) {
    try {
        const parsed = taskSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid task data.",
                errors: parsed.error.flatten(),
            });
        }

        const { organizationId, userId } = getContext(req);
        const task = await taskService.createTask(
            organizationId,
            userId,
            parsed.data
        );

        return res.status(201).json({ success: true, task });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function patchTask(req, res) {
    try {
        const parsed = updateTaskSchema.safeParse(req.body);

        if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Provide valid fields to update.",
                errors: parsed.success ? undefined : parsed.error.flatten(),
            });
        }

        const { organizationId, userId } = getContext(req);
        const task = await taskService.updateTask(
            organizationId,
            userId,
            req.params.id,
            parsed.data
        );

        return res.json({ success: true, task });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function removeTask(req, res) {
    try {
        const { organizationId, userId } = getContext(req);
        const result = await taskService.deleteTask(
            organizationId,
            userId,
            req.params.id
        );

        return res.json({ success: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getTaskSummary(req, res) {
    try {
        const { organizationId, userId } = getContext(req);
        const summary = await taskService.getTaskSummary(
            organizationId,
            userId
        );

        return res.json({ success: true, summary });
    } catch (error) {
        return sendError(res, error);
    }
}
