
import { z } from "zod";
import {
    loginSuperAdmin,
    getPlatformDashboard,
    listOrganizations,
    getOrganizationDetails,
    updateOrganizationStatus,
    listPlatformUsers,
    listAuditLogs,
} from "../services/super.admin.service.js";

const loginSchema = z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(72),
});

const listQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).default(""),
});

const organizationQuerySchema = listQuerySchema.extend({
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

const idSchema = z.string().min(1);

const statusSchema = z.object({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export async function superAdminLogin(req, res) {
    const input = loginSchema.parse(req.body);
    const data = await loginSuperAdmin(input);

    res.status(200).json({
        success: true,
        message: "Super Admin login successful",
        data,
    });
}

export async function superAdminDashboard(req, res) {
    const data = await getPlatformDashboard();

    res.status(200).json({
        success: true,
        data,
    });
}

export async function superAdminOrganizations(req, res) {
    const query = organizationQuerySchema.parse(req.query);
    const data = await listOrganizations(query);

    res.status(200).json({
        success: true,
        data,
    });
}

export async function superAdminOrganizationDetails(req, res) {
    const id = idSchema.parse(req.params.id);
    const data = await getOrganizationDetails(id);

    res.status(200).json({
        success: true,
        data,
    });
}

export async function superAdminUpdateOrganizationStatus(req, res) {
    const id = idSchema.parse(req.params.id);
    const { status } = statusSchema.parse(req.body);

    const data = await updateOrganizationStatus(id,
        status,
        req.platformAdmin.id);

    res.status(200).json({
        success: true,
        message: `Organization ${status.toLowerCase()} successfully`,
        data,
    });
}

export async function superAdminUsers(req, res) {
    const query = listQuerySchema.parse(req.query);
    const data = await listPlatformUsers(query);

    res.status(200).json({
        success: true,
        data,
    });
}


export async function superAdminAuditLogs(req, res) {
    const query = listQuerySchema.parse(req.query);

    const data = await listAuditLogs({
        page: query.page,
        limit: query.limit,
    });

    res.status(200).json({
        success: true,
        data,
    });
}
