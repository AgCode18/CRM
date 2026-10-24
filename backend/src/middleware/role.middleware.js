
const roleHierarchy = {
    OWNER: 4,
    ADMIN: 3,
    MANAGER: 2,
    SALES_REP: 1,
};

export function allowRoles(...allowedRoles) {
    return (req, res, next) => {
        const userRole = req.organization?.role;

        if (!userRole) {
            return res.status(403).json({
                success: false,
                message: "Organization context is required",
            });
        }

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to perform this action",
            });
        }

        next();
    };
}

export function requireMinimumRole(minimumRole) {
    return (req, res, next) => {
        const userRole = req.organization?.role;

        if (
            !userRole ||
            roleHierarchy[userRole] < roleHierarchy[minimumRole]
        ) {
            return res.status(403).json({
                success: false,
                message: "Insufficient organization permissions",
            });
        }

        next();
    };
}
