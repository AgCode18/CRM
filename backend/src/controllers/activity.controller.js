
import { z } from "zod";
import * as activityService from "../services/activity.service.js";

const createActivitySchema = z.object({
    type: z.enum([
        "NOTE",
        "CALL",
        "EMAIL",
        "MEETING",
        "STATUS_CHANGE",
    ]).optional(),
    description: z.string().trim().min(1).max(10000),
}).strict();

function sendError(res, error) {
    const status = error.status || 500;

    if (status === 500) {
        console.error("Activity API error:", error);
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

export async function getActivities(req, res) {
    try {
        const { organizationId } = getContext(req);
        const result = await activityService.listActivities(
            organizationId,
            req.query
        );

        return res.json({ success: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getActivityById(req, res) {
    try {
        const { organizationId } = getContext(req);
        const activity = await activityService.getActivity(
            organizationId,
            req.params.id
        );

        return res.json({ success: true, activity });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function postActivity(req, res) {
    try {
        const parsed = createActivitySchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid activity data.",
                errors: parsed.error.flatten(),
            });
        }

        const { organizationId, userId } = getContext(req);
        const activity = await activityService.createActivity(
            organizationId,
            userId,
            parsed.data
        );

        return res.status(201).json({ success: true, activity });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function removeActivity(req, res) {
    try {
        const { organizationId, userId } = getContext(req);
        const result = await activityService.deleteActivity(
            organizationId,
            userId,
            req.params.id
        );

        return res.json({ success: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getActivitySummary(req, res) {
    try {
        const { organizationId, userId } = getContext(req);
        const summary = await activityService.getActivitySummary(
            organizationId,
            userId
        );

        return res.json({ success: true, summary });
    } catch (error) {
        return sendError(res, error);
    }
}
