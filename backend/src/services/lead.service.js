
import prisma from "../config/prisma.js";

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

const leadSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    company: true,
    source: true,
    status: true,
    notes: true,
    assignedToId: true,
    createdAt: true,
    updatedAt: true,
    assignedTo: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
};

async function validateAssignee(organizationId, assignedToId) {
    if (assignedToId === undefined || assignedToId === null) {
        return;
    }

    const membership = await prisma.organizationMembership.findUnique({
        where: {
            userId_organizationId: {
                userId: assignedToId,
                organizationId,
            },
        },
        select: { id: true },
    });

    if (!membership) {
        throw createError(
            "Assignee does not belong to this organization",
            400
        );
    }
}

export async function createLead(organizationId, input) {
    await validateAssignee(organizationId, input.assignedToId);

    return prisma.lead.create({
        data: {
            name: input.name,
            email: input.email,
            phone: input.phone,
            company: input.company,
            source: input.source,
            status: input.status,
            notes: input.notes,
            assignedToId: input.assignedToId,
            organizationId,
        },
        select: leadSelect,
    });
}

export async function listLeads(organizationId, filters) {
    const { page, limit, search, status } = filters;

    const where = {
        organizationId,
        ...(status ? { status } : {}),
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

    const [leads, total] = await prisma.$transaction([
        prisma.lead.findMany({
            where,
            select: leadSelect,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.lead.count({ where }),
    ]);

    return {
        leads,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getLeadById(organizationId, leadId) {
    const lead = await prisma.lead.findFirst({
        where: {
            id: leadId,
            organizationId,
        },
        select: leadSelect,
    });

    if (!lead) {
        throw createError("Lead not found", 404);
    }

    return lead;
}

export async function updateLead(organizationId, leadId, input) {
    await getLeadById(organizationId, leadId);

    if (input.assignedToId !== undefined) {
        await validateAssignee(organizationId, input.assignedToId);
    }

    await prisma.lead.updateMany({
        where: {
            id: leadId,
            organizationId,
        },
        data: input,
    });

    return getLeadById(organizationId, leadId);
}

export async function deleteLead(organizationId, leadId) {
    const result = await prisma.lead.deleteMany({
        where: {
            id: leadId,
            organizationId,
        },
    });

    if (result.count === 0) {
        throw createError("Lead not found", 404);
    }

    return { id: leadId };
}
