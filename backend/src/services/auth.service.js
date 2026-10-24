import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { createOrganizationSlug } from "../utils/slugify.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";

if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
}

function createAccessToken(userId) {
    return jwt.sign({ sub: userId }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: "crm-api",
        audience: "crm-client",
    });
}

export async function registerUser({
    name,
    email,
    password,
    organizationName,
}) {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });

    if (existingUser) {
        const error = new Error("An account with this email already exists");
        error.statusCode = 409;
        throw error;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = createOrganizationSlug(organizationName);

    try {
        const user = await prisma.$transaction(async (tx) => {
            return tx.user.create({
                data: {
                    name: name.trim(),
                    email: normalizedEmail,
                    passwordHash,
                    memberships: {
                        create: {
                            role: "OWNER",
                            organization: {
                                create: {
                                    name: organizationName.trim(),
                                    slug,
                                },
                            },
                        },
                    },
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    createdAt: true,
                    memberships: {
                        select: {
                            role: true,
                            organization: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                },
                            },
                        },
                    },
                },
            });
        });

        return {
            user,
            accessToken: createAccessToken(user.id),
        };
    } catch (error) {
        if (error.code === "P2002") {
            const conflict = new Error(
                "An account or organization identifier already exists"
            );
            conflict.statusCode = 409;
            throw conflict;
        }

        throw error;
    }
}

export async function loginUser({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            memberships: {
                select: {
                    role: true,
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
            },
        },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
    }

    const { passwordHash, ...safeUser } = user;

    return {
        user: safeUser,
        accessToken: createAccessToken(user.id),
    };
}

export async function getAuthenticatedUser(userId) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            memberships: {
                select: {
                    role: true,
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
            },
        },
    });
}