import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export function authenticate(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }

    const token = authorization.slice(7).trim();

    try {
        const payload = jwt.verify(token, JWT_SECRET, {
            issuer: "crm-api",
            audience: "crm-client",
        });

        if (typeof payload.sub !== "string") {
            return res.status(401).json({
                success: false,
                message: "Invalid access token",
            });
        }

        req.user = { id: payload.sub };
        next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired access token",
        });
    }
}