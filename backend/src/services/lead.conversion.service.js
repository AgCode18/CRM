
import prisma from "../config/prisma.js";

const ALLOWED_ROLES = ["OWNER", "ADMIN", "MANAGER", "SALES_REP"];

function httpError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

export async function convertLeadToContact({
    leadId,
    organizationId,
    userId,
    contact = {},
    deal = null,
}) {
    if (!ALLOWED_ROLES.length) {
        throw new Error("Invalid role configuration.");
    }

    return prisma.$transaction(async (tx) => {
        const lead = await tx.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!lead) {
            throw httpError("Lead not found in this organization.", 404);
        }

        if (lead.status === "CONVERTED" || lead.contactId) {
            throw httpError("This lead has already been converted.", 409);
        }

        if (lead.status === "LOST") {
            throw httpError("A lost lead cannot be converted.", 400);
        }

        const name = contact.name?.trim() || lead.name;
        const email = contact.email?.trim() || lead.email;
        const phone = contact.phone?.trim() || lead.phone;
        const company = contact.company?.trim() || lead.company;
        const assignedToId = lead.assignedToId;

        if (assignedToId) {
            const assignment = await tx.organizationMembership.findFirst({
                where: { organizationId, userId: assignedToId },
                select: { userId: true },
            });

            if (!assignment) {
                throw httpError(
                    "The lead's assigned user is not a member of this organization.",
                    400
                );
            }
        }

        const newContact = await tx.contact.create({
            data: {
                name,
                email: email || null,
                phone: phone || null,
                company: company || null,
                organizationId,
                assignedToId,
            },
        });

        let newDeal = null;

        if (deal) {
            const title = deal.title?.trim();

            if (!title) {
                throw httpError("Deal title is required when creating a deal.", 400);
            }

            const value = Number(deal.value ?? 0);

            if (!Number.isFinite(value) || value < 0) {
                throw httpError("Deal value must be a valid non-negative number.", 400);
            }

            let expectedClose = null;

            if (deal.expectedClose) {
                expectedClose = new Date(deal.expectedClose);

                if (Number.isNaN(expectedClose.getTime())) {
                    throw httpError("Invalid expected close date.", 400);
                }
            }

            newDeal = await tx.deal.create({
                data: {
                    title,
                    value,
                    stage: "PROSPECTING",
                    expectedClose,
                    organizationId,
                    assignedToId,
                },
            });
        }

        const updatedLead = await tx.lead.update({
            where: { id: lead.id },
            data: {
                status: "CONVERTED",
                convertedAt: new Date(),
                contactId: newContact.id,
            },
        });

        await tx.activity.create({
            data: {
                type: "STATUS_CHANGE",
                description: `Lead "${lead.name}" converted to contact "${newContact.name}".${newDeal ? ` Deal "${newDeal.title}" was also created.` : ""
                    }`,
                organizationId,
                userId,
            },
        });

        return {
            lead: updatedLead,
            contact: newContact,
            deal: newDeal,
        };
    });
}
