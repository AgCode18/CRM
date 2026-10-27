
import { Router } from "express";
import {
  getNotifications,
  getUnreadCount,
  patchNotificationRead,
  patchAllNotificationsRead,
} from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrganization } from "../middleware/organization.middleware.js";

const router = Router();

router.use(authenticate, requireOrganization);

// Static routes must come before /:id routes.
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", patchAllNotificationsRead);
router.get("/", getNotifications);
router.patch("/:id/read", patchNotificationRead);

export default router;
