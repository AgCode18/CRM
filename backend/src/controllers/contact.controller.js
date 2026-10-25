import { z } from "zod";

import {
    listContacts,
    getContactById,
    createContact,
    updateContact,
    deleteContact,
} from "../services/contact.service.js";

const createContactSchema = z.object({
    name: z.string().trim().min(1).max(150),
    email: z.string().trim().email().max(191).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    company: z.string().trim().max(150).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
});

const updateContactSchema = z.object({
    name: z.string().trim().min(1).max(150).nullable().optional(),
    email: z.string().trim().email().max(191).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    company: z.string().trim().max(150).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Provide at least one field to update" }
);

const listContactsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).default(""),
    assigneeId: z.string().min(1).optional(),
});

function sendValidationError(res, parsed) {
    return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
    });
}

export async function getContacts(req, res) {
    const parsed = listContactsSchema.safeParse(req.query);

    if (!parsed.success) {
        return sendValidationError(res, parsed);
    }

    const data = await listContacts({
        organizationId: req.organization.id,
        userId: req.user.id,
        ...parsed.data,
    });

    return res.json({
        success: true,
        data,
    });
}

export async function getContact(req, res) {
    const data = await getContactById({
        organizationId: req.organization.id,
        userId: req.user.id,
        contactId: req.params.id,
    });

    return res.json({
        success: true,
        data,
    });
}

export async function postContact(req, res) {
    const parsed = createContactSchema.safeParse(req.body);

    if (!parsed.success) {
        return sendValidationError(res, parsed);
    }

    const data = await createContact({
        organizationId: req.organization.id,
        userId: req.user.id,
        data: parsed.data,
    });

    return res.status(201).json({
        success: true,
        message: "Contact created successfully",
        data,
    });
}

export async function patchContact(req, res) {
    const parsed = updateContactSchema.safeParse(req.body);

    if (!parsed.success) {
        return sendValidationError(res, parsed);
    }

    const data = await updateContact({
        organizationId: req.organization.id,
        userId: req.user.id,
        contactId: req.params.id,
        data: parsed.data,
    });

    return res.json({
        success: true,
        message: "Contact updated successfully",
        data,
    });
}

export async function removeContact(req, res) {
    const data = await deleteContact({
        organizationId: req.organization.id,
        userId: req.user.id,
        contactId: req.params.id,
    });

    return res.json({
        success: true,
        message: "Contact deleted successfully",
        data,
    });
}