
import prisma from "../config/prisma.js";

const LEAD_STATUSES = [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "LOST",
    "CONVERTED",
];

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function requireOrganizationMember(organizationId, userId) {
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
    if (!assigneeId) return null;

    const membership = await prisma.organizationMembership.findFirst({
        where: {
            organizationId,
            userId: assigneeId,
        },
        select: { userId: true },
    });

    if (!membership) {
        throw httpError(
            400,
            "The assigned user is not a member of this organization"
        );
    }

    return assigneeId;
}

export async function listLeads({
    organizationId,
    userId,
    page = 1,
    limit = 20,
    search = "",
    status,
    assigneeId,
}) {
    await requireOrganizationMember(organizationId, userId);

    const where = {
        organizationId,
        ...(status ? { status } : {}),
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

    const [total, leads] = await prisma.$transaction([
        prisma.lead.count({ where }),
        prisma.lead.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                assignee: {
                    select: { id: true, name: true, email: true },
                },
            },
        }),
    ]);

    return {
        items: leads,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getLeadById({
    organizationId,
    userId,
    leadId,
}) {
    await requireOrganizationMember(organizationId, userId);

    const lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId },
        include: {
            assignee: {
                select: { id: true, name: true, email: true },
            },
        },
    });

    if (!lead) throw httpError(404, "Lead not found");

    return lead;
}

export async function createLead({
    organizationId,
    userId,
    data,
}) {
    await requireOrganizationMember(organizationId, userId);

    const assigneeId = await validateAssignee(
        organizationId,
        data.assigneeId
    );

    return prisma.lead.create({
        data: {
            name: data.name.trim(),
            email: data.email?.trim().toLowerCase() || null,
            phone: data.phone?.trim() || null,
            company: data.company?.trim() || null,
            source: data.source?.trim() || null,
            notes: data.notes?.trim() || null,
            status: "NEW",
            organizationId,
            assigneeId,
        },
        include: {
            assignee: {
                select: { id: true, name: true, email: true },
            },
        },
    });
}

export async function updateLead({
    organizationId,
    userId,
    leadId,
    data,
}) {
    await requireOrganizationMember(organizationId, userId);

    const existing = await prisma.lead.findFirst({
        where: { id: leadId, organizationId },
        select: { id: true },
    });

    if (!existing) throw httpError(404, "Lead not found");

    const updateData = {};

    for (const field of ["name", "email", "phone", "company", "source", "notes"]) {
        if (data[field] !== undefined) {
            updateData[field] =
                typeof data[field] === "string" ? data[field].trim() || null : data[field];
        }
    }

    if (data.email !== undefined && data.email) {
        updateData.email = data.email.trim().toLowerCase();
    }

    if (data.status !== undefined) {
        if (!LEAD_STATUSES.includes(data.status)) {
            throw httpError(400, "Invalid lead status");
        }
        updateData.status = data.status;
    }

    if (data.assigneeId !== undefined) {
        updateData.assigneeId = await validateAssignee(
            organizationId,
            data.assigneeId
        );
    }

    return prisma.lead.update({
        where: { id: existing.id },
        data: updateData,
        include: {
            assignee: {
                select: { id: true, name: true, email: true },
            },
        },
    });
}

export async function deleteLead({
    organizationId,
    userId,
    leadId,
}) {
    const membership = await requireOrganizationMember(
        organizationId,
        userId
    );

    if (!["OWNER", "ADMIN"].includes(membership.role)) {
        throw httpError(403, "Only an owner or admin can delete leads");
    }

    const result = await prisma.lead.deleteMany({
        where: { id: leadId, organizationId },
    });

    if (result.count === 0) throw httpError(404, "Lead not found");

    return { id: leadId };
}
