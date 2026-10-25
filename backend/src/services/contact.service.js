// src/services/contact.service.js

import prisma from "../config/prisma.js";

const CONTACT_STATUSES = ["ACTIVE", "INACTIVE"];

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function requireMembership(organizationId, userId) {
    const membership = await prisma.organizationMembership.findFirst({
        where: { organizationId, userId },
        select: { id: true, role: true },
    });

    if (!membership) {
        throw httpError(403, "You are not a member of this organization");
    }

    return membership;
}

async function validateAssignee(organizationId, assigneeId) {
    if (assigneeId === undefined || assigneeId === null) {
        return assigneeId;
    }

    const membership = await prisma.organizationMembership.findFirst({
        where: {
            organizationId,
            userId: assigneeId,
        },
        select: { id: true },
    });

    if (!membership) {
        throw httpError(
            400,
            "Assigned user does not belong to this organization"
        );
    }

    return assigneeId;
}

const contactSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    company: true,
    notes: true,
    organizationId: true,
    assigneeId: true,
    createdAt: true,
    updatedAt: true,
    assignee: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
};

export async function listContacts({
    organizationId,
    userId,
    page = 1,
    limit = 20,
    search = "",
    assigneeId,
}) {
    await requireMembership(organizationId, userId);

    const where = {
        organizationId,
        ...(assigneeId ? { assigneeId } : {}),
        ...(search
            ? {
                OR: [
                    { name: { contains: search } },
                    { email: { contains: search } },
                    { phone: { contains: search } },
                    { company: { contains: search } },
                ],
            }
            : {}),
    };

    const [total, items] = await prisma.$transaction([
        prisma.contact.count({ where }),
        prisma.contact.findMany({
            where,
            select: contactSelect,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getContactById({
    organizationId,
    userId,
    contactId,
}) {
    await requireMembership(organizationId, userId);

    const contact = await prisma.contact.findFirst({
        where: {
            id: contactId,
            organizationId,
        },
        select: contactSelect,
    });

    if (!contact) {
        throw httpError(404, "Contact not found");
    }

    return contact;
}

export async function createContact({
    organizationId,
    userId,
    data,
}) {
    await requireMembership(organizationId, userId);

    const assigneeId = await validateAssignee(
        organizationId,
        data.assigneeId
    );

    return prisma.contact.create({
        data: {
            name: data.name.trim(),
            email: data.email ? data.email.trim().toLowerCase() : null,
            phone: data.phone?.trim() || null,
            company: data.company?.trim() || null,
            notes: data.notes?.trim() || null,
            organizationId,
            assigneeId: assigneeId ?? null,
        },
        select: contactSelect,
    });
}

export async function updateContact({
    organizationId,
    userId,
    contactId,
    data,
}) {
    await requireMembership(organizationId, userId);

    const existing = await prisma.contact.findFirst({
        where: {
            id: contactId,
            organizationId,
        },
        select: { id: true },
    });

    if (!existing) {
        throw httpError(404, "Contact not found");
    }

    const updateData = {};

    for (const field of ["name", "phone", "company", "notes"]) {
        if (data[field] !== undefined) {
            updateData[field] =
                data[field] === null ? null : data[field].trim() || null;
        }
    }

    if (data.email !== undefined) {
        updateData.email = data.email
            ? data.email.trim().toLowerCase()
            : null;
    }

    if (data.assigneeId !== undefined) {
        updateData.assigneeId = await validateAssignee(
            organizationId,
            data.assigneeId
        );
    }

    // Include organizationId in the update condition to prevent
    // cross-organization updates.
    const result = await prisma.contact.updateMany({
        where: {
            id: contactId,
            organizationId,
        },
        data: updateData,
    });

    if (result.count === 0) {
        throw httpError(404, "Contact not found");
    }

    return prisma.contact.findFirst({
        where: {
            id: contactId,
            organizationId,
        },
        select: contactSelect,
    });
}

export async function deleteContact({
    organizationId,
    userId,
    contactId,
}) {
    const membership = await requireMembership(
        organizationId,
        userId
    );

    if (!["OWNER", "ADMIN"].includes(membership.role)) {
        throw httpError(
            403,
            "Only an organization owner or admin can delete contacts"
        );
    }

    const result = await prisma.contact.deleteMany({
        where: {
            id: contactId,
            organizationId,
        },
    });

    if (result.count === 0) {
        throw httpError(404, "Contact not found");
    }

    return { id: contactId };
}