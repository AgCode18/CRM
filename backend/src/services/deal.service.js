
import prisma from "../config/prisma.js";

const DEAL_STAGES = [
    "PROSPECTING",
    "QUALIFICATION",
    "PROPOSAL",
    "NEGOTIATION",
    "WON",
    "LOST",
];

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

async function validateRelations({
    organizationId,
    contactId,
    leadId,
    assigneeId,
}) {
    if (assigneeId) {
        const membership = await prisma.organizationMembership.findFirst({
            where: { organizationId, userId: assigneeId },
            select: { id: true },
        });

        if (!membership) {
            throw httpError(400, "Assignee is not a member of this organization");
        }
    }

    if (contactId) {
        const contact = await prisma.contact.findFirst({
            where: { id: contactId, organizationId },
            select: { id: true },
        });

        if (!contact) throw httpError(400, "Contact not found in this organization");
    }

    if (leadId) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
            select: { id: true },
        });

        if (!lead) throw httpError(400, "Lead not found in this organization");
    }
}

const dealSelect = {
    id: true,
    name: true,
    value: true,
    stage: true,
    expectedCloseDate: true,
    organizationId: true,
    contactId: true,
    leadId: true,
    assigneeId: true,
    createdAt: true,
    updatedAt: true,
    contact: {
        select: { id: true, name: true, email: true, company: true },
    },
    lead: {
        select: { id: true, name: true, email: true, company: true },
    },
    assignee: {
        select: { id: true, name: true, email: true },
    },
};

export async function listDeals({
    organizationId,
    userId,
    page = 1,
    limit = 20,
    search = "",
    stage,
    assigneeId,
}) {
    await requireMembership(organizationId, userId);

    const where = {
        organizationId,
        ...(stage ? { stage } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(search
            ? {
                OR: [
                    { name: { contains: search } },
                    { contact: { name: { contains: search } } },
                    { lead: { name: { contains: search } } },
                ],
            }
            : {}),
    };

    const [total, items] = await prisma.$transaction([
        prisma.deal.count({ where }),
        prisma.deal.findMany({
            where,
            select: dealSelect,
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

export async function getDealById({ organizationId, userId, dealId }) {
    await requireMembership(organizationId, userId);

    const deal = await prisma.deal.findFirst({
        where: { id: dealId, organizationId },
        select: dealSelect,
    });

    if (!deal) throw httpError(404, "Deal not found");

    return deal;
}

export async function createDeal({ organizationId, userId, data }) {
    await requireMembership(organizationId, userId);

    await validateRelations({
        organizationId,
        contactId: data.contactId,
        leadId: data.leadId,
        assigneeId: data.assigneeId,
    });

    if (data.contactId && data.leadId) {
        throw httpError(400, "Link a deal to a contact or a lead, not both");
    }

    return prisma.deal.create({
        data: {
            name: data.name.trim(),
            value: data.value,
            stage: data.stage ?? "PROSPECTING",
            expectedCloseDate: data.expectedCloseDate
                ? new Date(data.expectedCloseDate)
                : null,
            organizationId,
            contactId: data.contactId ?? null,
            leadId: data.leadId ?? null,
            assigneeId: data.assigneeId ?? null,
        },
        select: dealSelect,
    });
}

export async function updateDeal({
    organizationId,
    userId,
    dealId,
    data,
}) {
    await requireMembership(organizationId, userId);

    const existing = await prisma.deal.findFirst({
        where: { id: dealId, organizationId },
        select: { id: true },
    });

    if (!existing) throw httpError(404, "Deal not found");

    await validateRelations({
        organizationId,
        contactId: data.contactId,
        leadId: data.leadId,
        assigneeId: data.assigneeId,
    });

    if (data.contactId && data.leadId) {
        throw httpError(400, "Link a deal to a contact or a lead, not both");
    }

    const updateData = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.value !== undefined) updateData.value = data.value;
    if (data.stage !== undefined) updateData.stage = data.stage;

    if (data.expectedCloseDate !== undefined) {
        updateData.expectedCloseDate = data.expectedCloseDate
            ? new Date(data.expectedCloseDate)
            : null;
    }

    for (const field of ["contactId", "leadId", "assigneeId"]) {
        if (data[field] !== undefined) {
            updateData[field] = data[field] ?? null;
        }
    }

    const result = await prisma.deal.updateMany({
        where: { id: dealId, organizationId },
        data: updateData,
    });

    if (!result.count) throw httpError(404, "Deal not found");

    return prisma.deal.findFirst({
        where: { id: dealId, organizationId },
        select: dealSelect,
    });
}

export async function deleteDeal({ organizationId, userId, dealId }) {
    const membership = await requireMembership(organizationId, userId);

    if (!["OWNER", "ADMIN"].includes(membership.role)) {
        throw httpError(403, "Only an owner or admin can delete deals");
    }

    const result = await prisma.deal.deleteMany({
        where: { id: dealId, organizationId },
    });

    if (!result.count) throw httpError(404, "Deal not found");

    return { id: dealId };
}

export async function getDealPipelineSummary({ organizationId, userId }) {
    await requireMembership(organizationId, userId);

    const groups = await prisma.deal.groupBy({
        by: ["stage"],
        where: { organizationId },
        _count: { _all: true },
        _sum: { value: true },
    });

    const summary = Object.fromEntries(
        DEAL_STAGES.map((stage) => [
            stage,
            { count: 0, value: 0 },
        ])
    );

    for (const group of groups) {
        summary[group.stage] = {
            count: group._count._all,
            value: Number(group._sum.value ?? 0),
        };
    }

    const totalDeals = Object.values(summary).reduce(
        (sum, item) => sum + item.count,
        0
    );

    const pipelineValue = Object.entries(summary)
        .filter(([stage]) => !["WON", "LOST"].includes(stage))
        .reduce((sum, [, item]) => sum + item.value, 0);

    return {
        totalDeals,
        pipelineValue,
        wonValue: summary.WON.value,
        lostValue: summary.LOST.value,
        stages: summary,
    };
}
