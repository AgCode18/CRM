
import { z } from "zod";
import {
    createLead,
    listLeads,
    getLeadById,
    updateLead,
    deleteLead,
} from "../services/lead.service.js";

const leadFields = {
    name: z.string().trim().min(2).max(150),
    email: z.string().trim().email().max(254).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    company: z.string().trim().max(150).nullable().optional(),
    source: z.string().trim().max(100).nullable().optional(),
    status: z.enum([
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "LOST",
        "CONVERTED",
    ]),
    notes: z.string().trim().max(5000).nullable().optional(),
    assignedToId: z.string().min(1).nullable().optional(),
};

const createLeadSchema = z.object({
    ...leadFields,
    name: leadFields.name,
    status: leadFields.status.optional(),
});

const updateLeadSchema = z.object(leadFields).partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "Provide at least one field to update" }
);

const listQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).default(""),
    status: leadFields.status.optional(),
});

const idSchema = z.string().min(1);

export async function createLeadController(req, res) {
    const input = createLeadSchema.parse(req.body);

    const lead = await createLead(req.organization.id, input);

    res.status(201).json({
        success: true,
        message: "Lead created successfully",
        data: { lead },
    });
}

export async function listLeadsController(req, res) {
    const filters = listQuerySchema.parse(req.query);

    const result = await listLeads(req.organization.id, filters);

    res.status(200).json({
        success: true,
        data: result,
    });
}

export async function getLeadController(req, res) {
    const leadId = idSchema.parse(req.params.id);

    const lead = await getLeadById(req.organization.id, leadId);

    res.status(200).json({
        success: true,
        data: { lead },
    });
}

export async function updateLeadController(req, res) {
    const leadId = idSchema.parse(req.params.id);
    const input = updateLeadSchema.parse(req.body);

    const lead = await updateLead(
        req.organization.id,
        leadId,
        input
    );

    res.status(200).json({
        success: true,
        message: "Lead updated successfully",
        data: { lead },
    });
}

export async function deleteLeadController(req, res) {
    const leadId = idSchema.parse(req.params.id);

    await deleteLead(req.organization.id, leadId);

    res.status(200).json({
        success: true,
        message: "Lead deleted successfully",
    });
}
