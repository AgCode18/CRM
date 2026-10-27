
import * as dashboardService from "../services/dashboard.service.js";

function sendError(res, error) {
    const status = error.status || 500;

    if (status === 500) {
        console.error("Dashboard API error:", error);
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

export async function getSummary(req, res) {
    try {
        const { organizationId, userId } = getContext(req);
        const summary = await dashboardService.getDashboardSummary(
            organizationId,
            userId,
            req.query
        );

        return res.json({ success: true, summary });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getLeadsAnalytics(req, res) {
    try {
        const { organizationId, userId } = getContext(req);
        const analytics = await dashboardService.getLeadAnalytics(
            organizationId,
            userId,
            req.query
        );

        return res.json({ success: true, analytics });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getDealsAnalytics(req, res) {
    try {
        const { organizationId, userId } = getContext(req);
        const analytics = await dashboardService.getDealAnalytics(
            organizationId,
            userId,
            req.query
        );

        return res.json({ success: true, analytics });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getSalespersonPerformance(req, res) {
    try {
        const { organizationId, userId } = getContext(req);
        const result = await dashboardService.getSalespersonPerformance(
            organizationId,
            userId,
            req.query
        );

        return res.json({ success: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}
