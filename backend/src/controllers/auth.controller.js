import { z } from "zod";
import {
    registerUser,
    loginUser,
    getAuthenticatedUser,
} from "../services/auth.service.js";

const registerSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    password: z.string().min(12).max(72),
    organizationName: z.string().trim().min(2).max(150),
});

const loginSchema = z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(72),
});

export async function register(req, res) {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);

    res.status(201).json({
        success: true,
        message: "Account and organization created successfully",
        data: result,
    });
}

export async function login(req, res) {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);

    res.status(200).json({
        success: true,
        message: "Login successful",
        data: result,
    });
}

export async function me(req, res) {
    const user = await getAuthenticatedUser(req.user.id);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "User account no longer exists",
        });
    }

    res.status(200).json({
        success: true,
        data: { user },
    });
}

export async function logout(req, res) {
    // Bearer access tokens are stateless. The client must discard this token.
    // Server-side token revocation will be added with refresh-token sessions.
    res.status(200).json({
        success: true,
        message: "Logout acknowledged. Discard the access token on the client.",
    });
}