
import prisma from "../config/prisma.js";

export async function requireOrganization(req, res, next) {
    try {
        const organizationId = req.headers["x-organization-id"];

        if (!organizationId || typeof organizationId !== "string") {
            return res.status(400).json({
                success: false,
                message: "X-Organization-Id header is required",
            });
        }

        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const membership =
            await prisma.organizationMembership.findUnique({
                where: {
                    userId_organizationId: {
                        userId: req.user.id,
                        organizationId,
                    },
                },
                select: {
                    organizationId: true,
                    role: true,
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            status: true,
                        },
                    },
                },
            });

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this organization",
            });
        }

        if (membership.organization.status === "SUSPENDED") {
            return res.status(403).json({
                success: false,
                code: "ORGANIZATION_SUSPENDED",
                message: "This organization is suspended. Contact platform support.",
            });
        }

        req.organization = {
            id: membership.organizationId,
            name: membership.organization.name,
            slug: membership.organization.slug,
            role: membership.role,
        };

        next();
    } catch (error) {
        next(error);
    }
}
