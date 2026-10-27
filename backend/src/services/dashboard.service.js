
import prisma from "../config/prisma.js";

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function parseDateRange(query = {}) {
    const now = new Date();
    let from;
    let to = now;

    if (query.from || query.to) {
        if (!query.from || !query.to) {
            throw httpError(400, "Provide both from and to dates.");
        }

        from = new Date(query.from);
        to = new Date(query.to);

        if (
            Number.isNaN(from.getTime()) ||
            Number.isNaN(to.getTime()) ||
            from > to
        ) {
            throw httpError(400, "Invalid date range.");
        }

        // Include the entire selected end date when YYYY-MM-DD is supplied.
        if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
            to.setUTCHours(23, 59, 59, 999);
        }
    } else {
        const range = query.range || "30d";

        if (range === "today") {
            from = new Date(now);
            from.setHours(0, 0, 0, 0);
        } else {
            const days = {
                "7d": 7,
                "30d": 30,
                "90d": 90,
            }[range];

            if (!days) {
                throw httpError(
                    400,
                    "range must be today, 7d, 30d, or 90d."
                );
            }

            from = new Date(now);
            from.setDate(from.getDate() - days);
        }
    }

    return { from, to };
}

async function requireMembership(organizationId, userId) {
    const membership = await prisma.organizationMembership.findFirst({
        where: { organizationId, userId },
        select: { role: true },
    });

    if (!membership) {
        throw httpError(403, "You are not a member of this organization.");
    }

    return membership;
}

function decimalToNumber(value) {
    return Number(value ?? 0);
}

// GET /api/v1/dashboard/summary
export async function getDashboardSummary(
    organizationId,
    userId,
    query
) {
    await requireMembership(organizationId, userId);

    const { from, to } = parseDateRange(query);

    const [
        totalLeads,
        newLeads,
        qualifiedLeads,
        convertedLeads,
        lostLeads,
        totalContacts,
        totalDeals,
        wonDeals,
        lostDeals,
        openDeals,
        dealStageGroups,
        pendingTasks,
        inProgressTasks,
        completedTasks,
        overdueTasks,
        recentLeads,
        recentDeals,
    ] = await Promise.all([
        prisma.lead.count({ where: { organizationId } }),
        prisma.lead.count({
            where: { organizationId, status: "NEW" },
        }),
        prisma.lead.count({
            where: { organizationId, status: "QUALIFIED" },
        }),
        prisma.lead.count({
            where: { organizationId, status: "CONVERTED" },
        }),
        prisma.lead.count({
            where: { organizationId, status: "LOST" },
        }),
        prisma.contact.count({ where: { organizationId } }),
        prisma.deal.count({ where: { organizationId } }),
        prisma.deal.aggregate({
            where: { organizationId, stage: "WON" },
            _count: { _all: true },
            _sum: { value: true },
        }),
        prisma.deal.aggregate({
            where: { organizationId, stage: "LOST" },
            _count: { _all: true },
            _sum: { value: true },
        }),
        prisma.deal.aggregate({
            where: {
                organizationId,
                stage: { notIn: ["WON", "LOST"] },
            },
            _count: { _all: true },
            _sum: { value: true },
        }),
        prisma.deal.groupBy({
            by: ["stage"],
            where: { organizationId },
            _count: { _all: true },
            _sum: { value: true },
        }),
        prisma.task.count({
            where: { organizationId, status: "PENDING" },
        }),
        prisma.task.count({
            where: { organizationId, status: "IN_PROGRESS" },
        }),
        prisma.task.count({
            where: { organizationId, status: "COMPLETED" },
        }),
        prisma.task.count({
            where: {
                organizationId,
                status: { not: "COMPLETED" },
                dueDate: { lt: new Date() },
            },
        }),
        prisma.lead.findMany({
            where: { organizationId, createdAt: { gte: from, lte: to } },
            select: {
                id: true,
                name: true,
                company: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
        }),
        prisma.deal.findMany({
            where: { organizationId, createdAt: { gte: from, lte: to } },
            select: {
                id: true,
                title: true,
                value: true,
                stage: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
        }),
    ]);

    const totalPipelineValue = decimalToNumber(openDeals._sum.value);
    const wonRevenue = decimalToNumber(wonDeals._sum.value);
    const lostDealValue = decimalToNumber(lostDeals._sum.value);

    const leadConversionRate =
        totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    const totalTasks = pendingTasks + inProgressTasks + completedTasks;
    const taskCompletionRate =
        totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return {
        period: {
            from: from.toISOString(),
            to: to.toISOString(),
        },
        leads: {
            total: totalLeads,
            new: newLeads,
            qualified: qualifiedLeads,
            converted: convertedLeads,
            lost: lostLeads,
            conversionRate: Number(leadConversionRate.toFixed(2)),
        },
        contacts: {
            total: totalContacts,
        },
        deals: {
            total: totalDeals,
            openCount: openDeals._count._all,
            wonCount: wonDeals._count._all,
            lostCount: lostDeals._count._all,
            pipelineValue: totalPipelineValue,
            wonRevenue,
            lostDealValue,
            byStage: dealStageGroups.map((group) => ({
                stage: group.stage,
                count: group._count._all,
                value: decimalToNumber(group._sum.value),
            })),
        },
        tasks: {
            pending: pendingTasks,
            inProgress: inProgressTasks,
            completed: completedTasks,
            overdue: overdueTasks,
            completionRate: Number(taskCompletionRate.toFixed(2)),
        },
        recentLeads,
        recentDeals: recentDeals.map((deal) => ({
            ...deal,
            value: decimalToNumber(deal.value),
        })),
    };
}

// GET /api/v1/dashboard/lead-analytics
export async function getLeadAnalytics(
    organizationId,
    userId,
    query
) {
    await requireMembership(organizationId, userId);

    const { from, to } = parseDateRange(query);

    const [statusGroups, leadsCreated, leadsUpdated] = await Promise.all([
        prisma.lead.groupBy({
            by: ["status"],
            where: { organizationId },
            _count: { _all: true },
        }),
        prisma.lead.count({
            where: { organizationId, createdAt: { gte: from, lte: to } },
        }),
        prisma.lead.count({
            where: { organizationId, updatedAt: { gte: from, lte: to } },
        }),
    ]);

    return {
        period: { from: from.toISOString(), to: to.toISOString() },
        createdDuringPeriod: leadsCreated,
        updatedDuringPeriod: leadsUpdated,
        byStatus: statusGroups.map((group) => ({
            status: group.status,
            count: group._count._all,
        })),
    };
}

// GET /api/v1/dashboard/deal-analytics
export async function getDealAnalytics(
    organizationId,
    userId,
    query
) {
    await requireMembership(organizationId, userId);

    const { from, to } = parseDateRange(query);

    const [stageGroups, dealsCreated, wonInPeriod, lostInPeriod] =
        await Promise.all([
            prisma.deal.groupBy({
                by: ["stage"],
                where: { organizationId },
                _count: { _all: true },
                _sum: { value: true },
            }),
            prisma.deal.count({
                where: { organizationId, createdAt: { gte: from, lte: to } },
            }),
            prisma.deal.aggregate({
                where: {
                    organizationId,
                    stage: "WON",
                    updatedAt: { gte: from, lte: to },
                },
                _count: { _all: true },
                _sum: { value: true },
            }),
            prisma.deal.aggregate({
                where: {
                    organizationId,
                    stage: "LOST",
                    updatedAt: { gte: from, lte: to },
                },
                _count: { _all: true },
                _sum: { value: true },
            }),
        ]);

    return {
        period: { from: from.toISOString(), to: to.toISOString() },
        createdDuringPeriod: dealsCreated,
        byStage: stageGroups.map((group) => ({
            stage: group.stage,
            count: group._count._all,
            value: decimalToNumber(group._sum.value),
        })),
        wonDuringPeriod: {
            count: wonInPeriod._count._all,
            value: decimalToNumber(wonInPeriod._sum.value),
        },
        lostDuringPeriod: {
            count: lostInPeriod._count._all,
            value: decimalToNumber(lostInPeriod._sum.value),
        },
    };
}

// GET /api/v1/dashboard/salesperson-performance
export async function getSalespersonPerformance(
    organizationId,
    userId,
    query
) {
    const membership = await requireMembership(organizationId, userId);

    if (!["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
        throw httpError(
            403,
            "Only owners, admins, and managers can view team performance."
        );
    }

    const { from, to } = parseDateRange(query);

    const members = await prisma.organizationMembership.findMany({
        where: { organizationId },
        select: {
            role: true,
            user: {
                select: { id: true, name: true, email: true },
            },
        },
    });

    const performance = await Promise.all(
        members.map(async (member) => {
            const assignedToId = member.user.id;

            const [leads, contacts, deals, wonDeals] = await Promise.all([
                prisma.lead.count({
                    where: {
                        organizationId,
                        assignedToId,
                        createdAt: { gte: from, lte: to },
                    },
                }),
                prisma.contact.count({
                    where: {
                        organizationId,
                        assignedToId,
                        createdAt: { gte: from, lte: to },
                    },
                }),
                prisma.deal.count({
                    where: {
                        organizationId,
                        assignedToId,
                        createdAt: { gte: from, lte: to },
                    },
                }),
                prisma.deal.aggregate({
                    where: {
                        organizationId,
                        assignedToId,
                        stage: "WON",
                        updatedAt: { gte: from, lte: to },
                    },
                    _count: { _all: true },
                    _sum: { value: true },
                }),
            ]);

            return {
                user: member.user,
                role: member.role,
                leadsCreated: leads,
                contactsCreated: contacts,
                dealsCreated: deals,
                wonDeals: wonDeals._count._all,
                wonRevenue: decimalToNumber(wonDeals._sum.value),
            };
        })
    );

    return { period: { from: from.toISOString(), to: to.toISOString() }, performance };
}
