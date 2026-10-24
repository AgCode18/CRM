
import prisma from "../config/prisma.js";
import { authenticate } from "./auth.middleware.js";

export const requireSuperAdmin = [
    authenticate,
    async (req, res, next) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    platformRole: true,
                },
            });

            if (!user || user.platformRole !== "SUPER_ADMIN") {
                return res.status(403).json({
                    success: false,
                    message: "Super Admin access required",
                });
            }

            req.platformAdmin = user;
            next();
        } catch (error) {
            next(error);
        }
    },
];
