
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

export async function updateOrganizationStatus(id, status) {
    const result = await prisma.organization.updateMany({
        where: { id },
        data: { status },
    });

    if (result.count === 0) {
        const error = new Error("Organization not found");
        error.statusCode = 404;
        throw error;
    }

    return prisma.organization.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            updatedAt: true,
        },
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
