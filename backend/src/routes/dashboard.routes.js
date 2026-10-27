
import { Router } from "express";
import {
    getSummary,
    getLeadsAnalytics,
    getDealsAnalytics,
    getSalespersonPerformance,
} from "../controllers/dashboard.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrganization } from "../middleware/organization.middleware.js";

const router = Router();

router.use(authenticate, requireOrganization);

router.get("/summary", getSummary);
router.get("/lead-analytics", getLeadsAnalytics);
router.get("/deal-analytics", getDealsAnalytics);
router.get("/salesperson-performance", getSalespersonPerformance);

export default router;
