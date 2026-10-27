
import { z } from "zod";

import {
    listDeals,
    getDealById,
    createDeal,
    updateDeal,
    deleteDeal,
    getDealPipelineSummary,
} from "../services/deal.service.js";

const dealFields = {
    name: z.string().trim().min(1).max(200),
    value: z.coerce.number().finite().min(0),
    stage: z.enum([
        "PROSPECTING",
        "QUALIFICATION",
        "PROPOSAL",
        "NEGOTIATION",
        "WON",
        "LOST",
    ]),
    expectedCloseDate: z.string().datetime().nullable(),
    contactId: z.string().min(1).nullable(),
    leadId: z.string().min(1).nullable(),
    assigneeId: z.string().min(1).nullable(),
};

const createDealSchema = z.object({
    name: dealFields.name,
    value: dealFields.value,
    stage: dealFields.stage.optional(),
    expectedCloseDate: dealFields.expectedCloseDate.optional(),
    contactId: dealFields.contactId.optional(),
    leadId: dealFields.leadId.optional(),
    assigneeId: dealFields.assigneeId.optional(),
});

const updateDealSchema = z.object({
    name: dealFields.name.optional(),
    value: dealFields.value.optional(),
    stage: dealFields.stage.optional(),
    expectedCloseDate: dealFields.expectedCloseDate.optional(),
    contactId: dealFields.contactId.optional(),
    leadId: dealFields.leadId.optional(),
    assigneeId: dealFields.assigneeId.optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
});

const listDealsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).default(""),
    stage: dealFields.stage.optional(),
    assigneeId: z.string().min(1).optional(),
});

function validationError(res, parsed) {
    return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
    });
}

export async function getDeals(req, res) {
    const parsed = listDealsSchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed);

    const data = await listDeals({
        organizationId: req.organization.id,
        userId: req.user.id,
        ...parsed.data,
    });

    return res.json({ success: true, data });
}

export async function getDeal(req, res) {
    const data = await getDealById({
        organizationId: req.organization.id,
        userId: req.user.id,
        dealId: req.params.id,
    });

    return res.json({ success: true, data });
}

export async function postDeal(req, res) {
    const parsed = createDealSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const data = await createDeal({
        organizationId: req.organization.id,
        userId: req.user.id,
        data: parsed.data,
    });

    return res.status(201).json({
        success: true,
        message: "Deal created successfully",
        data,
    });
}

export async function patchDeal(req, res) {
    const parsed = updateDealSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const data = await updateDeal({
        organizationId: req.organization.id,
        userId: req.user.id,
        dealId: req.params.id,
        data: parsed.data,
    });

    return res.json({
        success: true,
        message: "Deal updated successfully",
        data,
    });
}

export async function removeDeal(req, res) {
    const data = await deleteDeal({
        organizationId: req.organization.id,
        userId: req.user.id,
        dealId: req.params.id,
    });

    return res.json({
        success: true,
        message: "Deal deleted successfully",
        data,
    });
}

export async function getPipelineSummary(req, res) {
    const data = await getDealPipelineSummary({
        organizationId: req.organization.id,
        userId: req.user.id,
    });

    return res.json({ success: true, data });
}
