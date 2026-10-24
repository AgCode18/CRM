export const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err.name === "ZodError") {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: err.issues?.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        });
    }

    const statusCode =
        Number.isInteger(err.statusCode) &&
            err.statusCode >= 400 &&
            err.statusCode < 600
            ? err.statusCode
            : 500;

    if (process.env.NODE_ENV !== "production") {
        console.error(err);
    } else if (statusCode >= 500) {
        console.error("Internal server error:", err.message);
    }



    res.status(statusCode).json({
        success: false,
        message:
            statusCode >= 500 && process.env.NODE_ENV === "production"
                ? "Internal server error"
                : err.message || "Something went wrong",
    });
};