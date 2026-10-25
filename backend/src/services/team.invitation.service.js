import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";

const INVITABLE_ROLES = ["ADMIN", "MANAGER", "SALES_REP"];

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function normalizeEmail(email) {
    return email.trim().toLowerCase();
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function getExpiryDate() {
    const configuredHours = Number(process.env.INVITATION_EXPIRY_HOURS ?? 72);
    const hours =
        Number.isInteger(configuredHours) && configuredHours > 0
            ? configuredHours
            : 72;

    return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function requireTeamManager(tx, organizationId, actorId) {
    const membership = await tx.organizationMembership.findFirst({
        where: { organizationId, userId: actorId },
        select: { role: true },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        throw httpError(403, "Only the organization owner or admin can manage invitations");
    }

    return membership;
}

export async function createTeamInvitation({
    organizationId,
    actorId,
    email,
    role,
}) {
    const normalizedEmail = normalizeEmail(email);

    if (!INVITABLE_ROLES.includes(role)) {
        throw httpError(400, "Invalid invitation role");
    }

    return prisma.$transaction(async (tx) => {
        await requireTeamManager(tx, organizationId, actorId);

        const existingUser = await tx.user.findUnique({
            where: { email: normalizedEmail },
            select: {
                id: true,
                memberships: {
                    where: { organizationId },
                    select: { id: true },
                },
            },
        });

        if (existingUser?.memberships.length) {
            throw httpError(409, "This user already belongs to the organization");
        }

        const pendingInvitations = await tx.organizationInvitation.findMany({
            where: {
                organizationId,
                email: normalizedEmail,
                status: "PENDING",
            },
            select: { id: true, expiresAt: true },
        });

        const now = new Date();

        for (const invitation of pendingInvitations) {
            if (invitation.expiresAt > now) {
                throw httpError(409, "A pending invitation already exists for this email");
            }

            await tx.organizationInvitation.update({
                where: { id: invitation.id },
                data: { status: "EXPIRED" },
            });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = hashToken(token);

        const invitation = await tx.organizationInvitation.create({
            data: {
                email: normalizedEmail,
                role,
                tokenHash,
                expiresAt: getExpiryDate(),
                organizationId,
                invitedById: actorId,
            },
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
                expiresAt: true,
                createdAt: true,
            },
        });

        // The raw token is returned to the controller so it can send
        // the invitation email. Never store the raw token in the database.
        return { invitation, token };
    });
}

export async function listTeamInvitations({
    organizationId,
    actorId,
}) {
    await requireTeamManager(prisma, organizationId, actorId);

    const invitations = await prisma.organizationInvitation.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            email: true,
            role: true,
            status: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
            createdAt: true,
            invitedBy: {
                select: { id: true, name: true, email: true },
            },
        },
    });

    const now = new Date();

    return invitations.map((invitation) => ({
        ...invitation,
        status:
            invitation.status === "PENDING" && invitation.expiresAt <= now
                ? "EXPIRED"
                : invitation.status,
    }));
}

export async function revokeTeamInvitation({
    organizationId,
    actorId,
    invitationId,
}) {
    return prisma.$transaction(async (tx) => {
        await requireTeamManager(tx, organizationId, actorId);

        const invitation = await tx.organizationInvitation.findFirst({
            where: { id: invitationId, organizationId },
        });

        if (!invitation) {
            throw httpError(404, "Invitation not found");
        }

        if (invitation.status !== "PENDING") {
            throw httpError(409, "Only pending invitations can be revoked");
        }

        if (invitation.expiresAt <= new Date()) {
            await tx.organizationInvitation.update({
                where: { id: invitation.id },
                data: { status: "EXPIRED" },
            });

            throw httpError(409, "This invitation has expired");
        }

        return tx.organizationInvitation.update({
            where: { id: invitation.id },
            data: { status: "REVOKED", revokedAt: new Date() },
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
                revokedAt: true,
            },
        });
    });
}

export async function acceptTeamInvitation({
    token,
    name,
    password,
}) {
    if (typeof token !== "string" || token.length !== 64) {
        throw httpError(400, "Invalid or expired invitation token");
    }

    if (
        typeof password !== "string" ||
        password.length < 12 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        throw httpError(400, "Password must be at least 12 characters and at most 72 UTF-8 bytes");
    }

    if (typeof name !== "string" || !name.trim()) {
        throw httpError(400, "Name is required");
    }

    const tokenHash = hashToken(token);
    const passwordHash = await bcrypt.hash(password, 12);

    return prisma.$transaction(async (tx) => {
        const invitation = await tx.organizationInvitation.findUnique({
            where: { tokenHash },
        });

        if (!invitation || invitation.status !== "PENDING") {
            throw httpError(400, "Invalid or expired invitation token");
        }

        if (invitation.expiresAt <= new Date()) {
            await tx.organizationInvitation.update({
                where: { id: invitation.id },
                data: { status: "EXPIRED" },
            });

            throw httpError(400, "This invitation has expired");
        }

        const existingUser = await tx.user.findUnique({
            where: { email: invitation.email },
            select: {
                id: true,
                passwordHash: true,
                memberships: {
                    where: { organizationId: invitation.organizationId },
                    select: { id: true },
                },
            },
        });

        if (existingUser?.memberships.length) {
            throw httpError(409, "This user already belongs to the organization");
        }

        let user;

        if (existingUser) {
            const passwordMatches = await bcrypt.compare(
                password,
                existingUser.passwordHash
            );

            if (!passwordMatches) {
                throw httpError(401, "Invalid credentials for this existing account");
            }

            user = existingUser;
        } else {
            user = await tx.user.create({
                data: {
                    name: name.trim(),
                    email: invitation.email,
                    passwordHash,
                },
                select: { id: true },
            });
        }

        await tx.organizationMembership.create({
            data: {
                organizationId: invitation.organizationId,
                userId: user.id,
                role: invitation.role,
            },
        });

        await tx.organizationInvitation.update({
            where: { id: invitation.id },
            data: {
                status: "ACCEPTED",
                acceptedAt: new Date(),
            },
        });

        return {
            userId: user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
            email: invitation.email,
        };
    });
}