
import {
    listPlatformAuditLogs,
    listOrganizationAuditLogs,
} from "../services/audit-log.service.js";

export async function getPlatformAuditLogs(req, res) {
    const result = await listPlatformAuditLogs(req.query);

    return res.status(200).json({
        success: true,
        message: "Platform audit logs fetched successfully.",
        ...result,
    });
}

export async function getOrganizationAuditLogs(req, res) {
    const result = await listOrganizationAuditLogs({
        userId: req.user.id,
        organizationId: req.organization.id,
        query: req.query,
    });

    return res.status(200).json({
        success: true,
        message: "Organization audit logs fetched successfully.",
        ...result,
    });
}
