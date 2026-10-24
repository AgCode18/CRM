
import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";

async function main() {
    const name = process.env.SUPER_ADMIN_NAME?.trim();
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!name || !email || !password) {
        throw new Error(
            "Set SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in backend/.env"
        );
    }

    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
        throw new Error(
            "Super Admin password must be at least 12 characters and at most 72 UTF-8 bytes"
        );
    }

    const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, platformRole: true },
    });

    if (existing) {
        if (existing.platformRole === "SUPER_ADMIN") {
            throw new Error("This Super Admin account already exists");
        }

        throw new Error(
            "This email already belongs to a regular account. Use a different email."
        );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
        data: {
            name,
            email,
            passwordHash,
            platformRole: "SUPER_ADMIN",
        },
        select: {
            id: true,
            name: true,
            email: true,
            platformRole: true,
        },
    });

    console.log("Super Admin created:", admin);
}

main()
    .catch((error) => {
        console.error("Super Admin setup failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
