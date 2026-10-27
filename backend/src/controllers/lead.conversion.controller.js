
import { z } from "zod";
import { convertLeadToContact } from "../services/lead-conversion.service.js";

const optionalString = z.string().trim().optional();

const conversionSchema = z.object({
    contact: z.object({
        name: z.string().trim().min(1).optional(),
        email: z.string().trim().email().optional().or(z.literal("")),
        phone: optionalString,
        company: optionalString,
    }).optional(),

    deal: z.object({
        title: z.string().trim().min(1),
        value: z.coerce.number().finite().min(0).optional(),
        expectedClose: z.string().datetime().optional(),
    }).nullable().optional(),
});

export async function convertLead(req, res) {
    const parsed = conversionSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid conversion data.",
            errors: parsed.error.flatten(),
        });
    }

    const result = await convertLeadToContact({
        leadId: req.params.leadId,
        organizationId: req.organization.id,
        userId: req.user.id,
        ...parsed.data,
    });

    return res.status(201).json({
        success: true,
        message: "Lead converted successfully.",
        data: result,
    });
}
