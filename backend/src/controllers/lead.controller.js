
import { z } from "zod";
import {
    listLeads,
    getLeadById,
    createLead,
    updateLead,
    deleteLead,
} from "../services/lead.service.js";

const optionalText = z.string().trim().max(200).nullable().optional();

const createLeadSchema = z.object({
    name: z.string().trim().min(1).max(150),
    email: z.string().trim().email().max(191).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    company: z.string().trim().max(150).nullable().optional(),
    source: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
});

const updateLeadSchema = z.object({
    name: z.string().trim().min(1).max(150).optional(),
    email: z.string().trim().email().max(191).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    company: z.string().trim().max(150).nullable().optional(),
    source: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    status: z.enum([
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "LOST",
        "CONVERTED",
    ]).optional(),
    assigneeId: z.string().min(1).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
});

const listLeadsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).default(""),
    status: z.enum([
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "LOST",
        "CONVERTED",
    ]).optional(),
    assigneeId: z.string().min(1).optional(),
});

function validationError(res, parsed) {
    return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
    });
}

export async function getLeads(req, res) {
    const parsed = listLeadsSchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed);

    const data = await listLeads({
        organizationId: req.organization.id,
        userId: req.user.id,
        ...parsed.data,
    });

    res.json({ success: true, data });
}

export async function getLead(req, res) {
    const data = await getLeadById({
        organizationId: req.organization.id,
        userId: req.user.id,
        leadId: req.params.id,
    });

    res.json({ success: true, data });
}

export async function postLead(req, res) {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const data = await createLead({
        organizationId: req.organization.id,
        userId: req.user.id,
        data: parsed.data,
    });

    res.status(201).json({
        success: true,
        message: "Lead created",
        data,
    });
}

export async function patchLead(req, res) {
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const data = await updateLead({
        organizationId: req.organization.id,
        userId: req.user.id,
        leadId: req.params.id,
        data: parsed.data,
    });

    res.json({
        success: true,
        message: "Lead updated",
        data,
    });
}

export async function removeLead(req, res) {
    const data = await deleteLead({
        organizationId: req.organization.id,
        userId: req.user.id,
        leadId: req.params.id,
    });

    res.json({
        success: true,
        message: "Lead deleted",
        data,
    });
}
