
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";

if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
}

function createAdminToken(userId) {
    return jwt.sign(
        { sub: userId },
        JWT_SECRET,
        {
            expiresIn: JWT_EXPIRES_IN,
            issuer: "crm-api",
            audience: "crm-client",
        }
    );
}

export async function loginSuperAdmin({ email, password }) {
    const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            platformRole: true,
        },
    });

    // Use the same response for invalid credentials and non-admin accounts.
    if (
        !user ||
        user.platformRole !== "SUPER_ADMIN" ||
        !(await bcrypt.compare(password, user.passwordHash))
    ) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
    }

    await prisma.auditLog.create({
        data: {
            action: "SUPER_ADMIN_LOGIN",
            description: "Super Admin logged in successfully",
            actorId: user.id,
        },
    });

    return {
        accessToken: createAdminToken(user.id),
        admin: {
            id: user.id,
            name: user.name,
            email: user.email,
            platformRole: user.platformRole,
        },
    };
}

export async function getPlatformDashboard() {
    const [
        totalOrganizations,
        activeOrganizations,
        suspendedOrganizations,
        totalUsers,
        totalLeads,
        totalContacts,
        totalDeals,
    ] = await Promise.all([
        prisma.organization.count(),
        prisma.organization.count({ where: { status: "ACTIVE" } }),
        prisma.organization.count({ where: { status: "SUSPENDED" } }),
        prisma.user.count(),
        prisma.lead.count(),
        prisma.contact.count(),
        prisma.deal.count(),
    ]);

    return {
        totalOrganizations,
        activeOrganizations,
        suspendedOrganizations,
        totalUsers,
        totalLeads,
        totalContacts,
        totalDeals,
    };
}

export async function listOrganizations({ page, limit, search, status }) {
    const where = {
        ...(status ? { status } : {}),
        ...(search
            ? {
                OR: [
                    { name: { contains: search } },
                    { slug: { contains: search } },
                ],
            }
            : {}),
    };

    const [organizations, total] = await prisma.$transaction([
        prisma.organization.findMany({
            where,
            select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                createdAt: true,
                _count: {
                    select: {
                        memberships: true,
                        leads: true,
                        contacts: true,
                        deals: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.organization.count({ where }),
    ]);

    return {
        organizations,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getOrganizationDetails(id) {
    const organization = await prisma.organization.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            memberships: {
                select: {
                    role: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    leads: true,
                    contacts: true,
                    deals: true,
                    tasks: true,
                },
            },
        },
    });

    if (!organization) {
        const error = new Error("Organization not found");
        error.statusCode = 404;
        throw error;
    }

    return organization;
}


export async function updateOrganizationStatus(
    id,
    status,
    actorId
) {
    const organization = await prisma.organization.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            status: true,
        },
    });

    if (!organization) {
        const error = new Error("Organization not found");
        error.statusCode = 404;
        throw error;
    }

    if (organization.status === status) {
        return organization;
    }

    const action =
        status === "SUSPENDED"
            ? "ORGANIZATION_SUSPENDED"
            : "ORGANIZATION_ACTIVATED";

    const description =
        status === "SUSPENDED"
            ? `Organization ${organization.name} suspended`
            : `Organization ${organization.name} activated`;

    return prisma.$transaction(async (tx) => {
        const updated = await tx.organization.update({
            where: { id },
            data: { status },
            select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                updatedAt: true,
            },
        });

        await tx.auditLog.create({
            data: {
                action,
                description,
                actorId,
                organizationId: id,
                metadata: {
                    previousStatus: organization.status,
                    newStatus: status,
                },
            },
        });

        return updated;
    });
}


export async function listPlatformUsers({ page, limit, search }) {
    const where = {
        ...(search
            ? {
                OR: [
                    { name: { contains: search } },
                    { email: { contains: search } },
                ],
            }
            : {}),
    };

    const [users, total] = await prisma.$transaction([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                platformRole: true,
                createdAt: true,
                memberships: {
                    select: {
                        role: true,
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                status: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.user.count({ where }),
    ]);

    return {
        users,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}



export async function listAuditLogs({ page, limit }) {
    const [logs, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
            select: {
                id: true,
                action: true,
                description: true,
                actorId: true,
                organizationId: true,
                metadata: true,
                createdAt: true,
                actor: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
                organization: {
                    select: {
                        name: true,
                        slug: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.auditLog.count(),
    ]);

    return {
        logs,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
