import { Router } from "express";
import {
    register,
    login,
    me,
    logout,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/async.handler.js";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));

router.get("/me", authenticate, asyncHandler(me));
router.post("/logout", authenticate, asyncHandler(logout));

export default router;