
import * as notificationService from "../services/notification.service.js";

function sendError(res, error) {
    const status = error.status || 500;

    if (status === 500) {
        console.error("Notification API error:", error);
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

export async function getNotifications(req, res) {
    try {
        const { organizationId, userId } = getContext(req);

        const result = await notificationService.listNotifications(
            organizationId,
            userId,
            req.query
        );

        return res.json({ success: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getUnreadCount(req, res) {
    try {
        const { organizationId, userId } = getContext(req);

        const result = await notificationService.getUnreadCount(
            organizationId,
            userId
        );

        return res.json({ success: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function patchNotificationRead(req, res) {
    try {
        const { organizationId, userId } = getContext(req);

        const result = await notificationService.markNotificationRead(
            organizationId,
            userId,
            req.params.id
        );

        return res.json({ success: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function patchAllNotificationsRead(req, res) {
    try {
        const { organizationId, userId } = getContext(req);

        const result = await notificationService.markAllNotificationsRead(
            organizationId,
            userId
        );

        return res.json({ success: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}
