
import prisma from "../config/prisma.js";

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  readAt: true,
  entityType: true,
  entityId: true,
  createdAt: true,
};

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const NOTIFICATION_TYPES = [
  "TASK_ASSIGNED",
  "TASK_DUE",
  "TASK_OVERDUE",
  "DEAL_UPDATED",
  "DEAL_ASSIGNED",
  "SYSTEM",
];

async function requireMembership(organizationId, userId) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });

  if (!membership) {
    throw httpError(403, "You are not a member of this organization.");
  }
}

// GET /api/v1/notifications
export async function listNotifications(organizationId, userId, query = {}) {
  await requireMembership(organizationId, userId);

  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(query.limit, 10) || 20)
  );

  const where = { organizationId, userId };

  if (query.isRead !== undefined) {
    if (!["true", "false"].includes(query.isRead)) {
      throw httpError(400, "isRead must be true or false.");
    }

    where.isRead = query.isRead === "true";
  }

  if (query.type) {
    if (!NOTIFICATION_TYPES.includes(query.type)) {
      throw httpError(400, "Invalid notification type.");
    }

    where.type = query.type;
  }

  const [notifications, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      select: notificationSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { organizationId, userId, isRead: false },
    }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// GET /api/v1/notifications/unread-count
export async function getUnreadCount(organizationId, userId) {
  await requireMembership(organizationId, userId);

  const count = await prisma.notification.count({
    where: { organizationId, userId, isRead: false },
  });

  return { unreadCount: count };
}

// PATCH /api/v1/notifications/:id/read
export async function markNotificationRead(
  organizationId,
  userId,
  notificationId
) {
  await requireMembership(organizationId, userId);

  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      organizationId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  if (result.count === 0) {
    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, organizationId, userId },
      select: { id: true, isRead: true },
    });

    if (!existing) {
      throw httpError(404, "Notification not found.");
    }

    return { message: "Notification was already read." };
  }

  return { message: "Notification marked as read." };
}

// PATCH /api/v1/notifications/read-all
export async function markAllNotificationsRead(organizationId, userId) {
  await requireMembership(organizationId, userId);

  const result = await prisma.notification.updateMany({
    where: { organizationId, userId, isRead: false },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return {
    message: "Notifications marked as read.",
    updatedCount: result.count,
  };
}

// Internal service function for trusted backend workflows.
// Do not expose this directly as a public API endpoint.
export async function createNotification({
  organizationId,
  userId,
  type = "SYSTEM",
  title,
  message,
  entityType = null,
  entityId = null,
}) {
  if (!organizationId || !userId || !title?.trim() || !message?.trim()) {
    throw httpError(
      400,
      "organizationId, userId, title, and message are required."
    );
  }

  if (!NOTIFICATION_TYPES.includes(type)) {
    throw httpError(400, "Invalid notification type.");
  }

  if (title.length > 191) {
    throw httpError(400, "Notification title cannot exceed 191 characters.");
  }

  if (entityType && entityType.length > 50) {
    throw httpError(400, "entityType cannot exceed 50 characters.");
  }

  if (entityId && entityId.length > 191) {
    throw httpError(400, "entityId cannot exceed 191 characters.");
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });

  if (!membership) {
    throw httpError(
      400,
      "Notification recipient must belong to the organization."
    );
  }

  return prisma.notification.create({
    data: {
      organizationId,
      userId,
      type,
      title: title.trim(),
      message: message.trim(),
      entityType,
      entityId,
    },
    select: notificationSelect,
  });
}
