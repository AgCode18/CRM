
import prisma from "../config/prisma.js";

const TRIGGERS = [
  "LEAD_CREATED",
  "LEAD_STATUS_CHANGED",
  "DEAL_STAGE_CHANGED",
  "TASK_DUE",
];

const ACTIONS = ["CREATE_TASK", "SEND_NOTIFICATION"];

const STATUSES = ["RUNNING", "SUCCESS", "SKIPPED", "FAILED"];

const PAGE_LIMIT = 100;

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateRuleInput(input, { partial = false } = {}) {
  if (!partial || input.name !== undefined) {
    if (
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.trim().length > 191
    ) {
      throw httpError("Rule name is required (maximum 191 characters).");
    }
  }

  if (!partial || input.trigger !== undefined) {
    if (!TRIGGERS.includes(input.trigger)) {
      throw httpError("Invalid automation trigger.");
    }
  }

  if (!partial || input.actionType !== undefined) {
    if (!ACTIONS.includes(input.actionType)) {
      throw httpError("Invalid automation action.");
    }
  }

  if (input.conditions !== undefined && input.conditions !== null) {
    if (
      typeof input.conditions !== "object" ||
      Array.isArray(input.conditions)
    ) {
      throw httpError("Conditions must be a JSON object.");
    }
  }

  if (input.actionConfig !== undefined) {
    if (
      !input.actionConfig ||
      typeof input.actionConfig !== "object" ||
      Array.isArray(input.actionConfig)
    ) {
      throw httpError("Action configuration must be a JSON object.");
    }
  }

  if (input.isEnabled !== undefined && typeof input.isEnabled !== "boolean") {
    throw httpError("isEnabled must be a boolean.");
  }

  if (
    input.description !== undefined &&
    input.description !== null &&
    typeof input.description !== "string"
  ) {
    throw httpError("Description must be a string.");
  }
}

function validateActionConfig(actionType, config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw httpError("A valid actionConfig object is required.");
  }

  if (actionType === "CREATE_TASK") {
    if (typeof config.title !== "string" || !config.title.trim()) {
      throw httpError("CREATE_TASK requires a title.");
    }

    if (config.title.trim().length > 191) {
      throw httpError("Task title must not exceed 191 characters.");
    }

    if (
      config.dueInHours !== undefined &&
      (!Number.isFinite(config.dueInHours) ||
        config.dueInHours < 0 ||
        config.dueInHours > 8760)
    ) {
      throw httpError("dueInHours must be between 0 and 8760.");
    }
  }

  if (actionType === "SEND_NOTIFICATION") {
    if (typeof config.title !== "string" || !config.title.trim()) {
      throw httpError("SEND_NOTIFICATION requires a title.");
    }

    if (typeof config.message !== "string" || !config.message.trim()) {
      throw httpError("SEND_NOTIFICATION requires a message.");
    }

    if (config.title.trim().length > 191) {
      throw httpError("Notification title must not exceed 191 characters.");
    }
  }
}

function validateConditions(conditions) {
  if (!conditions) return;

  const allowedKeys = {
    LEAD_CREATED: ["status", "source"],
    LEAD_STATUS_CHANGED: ["fromStatus", "toStatus"],
    DEAL_STAGE_CHANGED: ["fromStage", "toStage"],
    TASK_DUE: ["status"],
  };

  const allowed = allowedKeys[conditions.trigger];

  if (!allowed) return;

  for (const key of Object.keys(conditions)) {
    if (key !== "trigger" && !allowed.includes(key)) {
      throw httpError(`Unsupported condition: ${key}`);
    }
  }
}

function matchesConditions(conditions, event) {
  if (!conditions) return true;

  for (const [key, expected] of Object.entries(conditions)) {
    if (key === "trigger") continue;

    if (event[key] !== expected) return false;
  }

  return true;
}

function getPagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    PAGE_LIMIT,
    Math.max(1, Number.parseInt(query.limit, 10) || 20),
  );

  return { page, limit, skip: (page - 1) * limit };
}

async function assertAssigneeBelongsToOrganization(
  tx,
  organizationId,
  userId,
) {
  if (!userId) return;

  const membership = await tx.organizationMembership.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });

  if (!membership) {
    throw httpError(
      "The assigned user is not a member of this organization.",
      400,
    );
  }
}

async function resolveTaskAssignee(tx, organizationId, config, event) {
  const assigneeId =
    config.assignedToId === "EVENT_ASSIGNEE"
      ? event.assignedToId
      : config.assignedToId || event.assignedToId || null;

  await assertAssigneeBelongsToOrganization(
    tx,
    organizationId,
    assigneeId,
  );

  return assigneeId;
}

async function resolveNotificationRecipients(
  tx,
  organizationId,
  config,
  event,
) {
  let userIds;

  if (config.recipient === "ASSIGNEE") {
    userIds = event.assignedToId ? [event.assignedToId] : [];
  } else if (config.recipient === "ACTOR") {
    userIds = event.actorId ? [event.actorId] : [];
  } else if (config.recipient === "ALL_MEMBERS") {
    const memberships = await tx.organizationMembership.findMany({
      where: { organizationId },
      select: { userId: true },
    });

    userIds = memberships.map((membership) => membership.userId);
  } else if (Array.isArray(config.userIds)) {
    userIds = [...new Set(config.userIds)];
  } else {
    throw httpError(
      "Recipient must be ASSIGNEE, ACTOR, ALL_MEMBERS, or userIds.",
    );
  }

  if (userIds.length === 0) return [];

  const memberships = await tx.organizationMembership.findMany({
    where: {
      organizationId,
      userId: { in: userIds },
    },
    select: { userId: true },
  });

  const validIds = new Set(memberships.map((item) => item.userId));

  if (userIds.some((id) => !validIds.has(id))) {
    throw httpError(
      "One or more notification recipients are not organization members.",
    );
  }

  return userIds;
}

// Create an automation rule.
export async function createAutomationRule({
  organizationId,
  input,
}) {
  validateRuleInput(input);
  validateActionConfig(input.actionType, input.actionConfig);

  if (input.conditions) {
    validateConditions(input.conditions);
  }

  return prisma.automationRule.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      trigger: input.trigger,
      actionType: input.actionType,
      conditions: input.conditions ?? undefined,
      actionConfig: input.actionConfig,
      isEnabled: input.isEnabled ?? true,
      organizationId,
    },
  });
}

// List automation rules belonging to the current organization.
export async function listAutomationRules({
  organizationId,
  query = {},
}) {
  const { page, limit, skip } = getPagination(query);

  const where = {
    organizationId,
    ...(query.trigger && { trigger: query.trigger }),
    ...(query.isEnabled !== undefined && {
      isEnabled: query.isEnabled === "true",
    }),
  };

  if (where.trigger && !TRIGGERS.includes(where.trigger)) {
    throw httpError("Invalid automation trigger.");
  }

  if (
    query.isEnabled !== undefined &&
    !["true", "false"].includes(query.isEnabled)
  ) {
    throw httpError("isEnabled must be true or false.");
  }

  const [rules, total] = await prisma.$transaction([
    prisma.automationRule.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.automationRule.count({ where }),
  ]);

  return {
    data: rules,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Retrieve one rule without crossing organization boundaries.
export async function getAutomationRule({
  organizationId,
  ruleId,
}) {
  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, organizationId },
  });

  if (!rule) throw httpError("Automation rule not found.", 404);

  return rule;
}

// Update a rule.
export async function updateAutomationRule({
  organizationId,
  ruleId,
  input,
}) {
  validateRuleInput(input, { partial: true });

  const existing = await getAutomationRule({ organizationId, ruleId });

  const actionType = input.actionType ?? existing.actionType;
  const actionConfig = input.actionConfig ?? existing.actionConfig;
  const conditions =
    input.conditions !== undefined
      ? input.conditions
      : existing.conditions;

  validateActionConfig(actionType, actionConfig);

  if (conditions) validateConditions(conditions);

  const data = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }
  if (input.trigger !== undefined) data.trigger = input.trigger;
  if (input.actionType !== undefined) data.actionType = input.actionType;
  if (input.actionConfig !== undefined) {
    data.actionConfig = input.actionConfig;
  }
  if (input.conditions !== undefined) {
    data.conditions = input.conditions;
  }
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;

  return prisma.automationRule.update({
    where: { id: existing.id },
    data,
  });
}

// Enable or disable a rule.
export async function setAutomationRuleEnabled({
  organizationId,
  ruleId,
  isEnabled,
}) {
  if (typeof isEnabled !== "boolean") {
    throw httpError("isEnabled must be a boolean.");
  }

  const existing = await getAutomationRule({ organizationId, ruleId });

  return prisma.automationRule.update({
    where: { id: existing.id },
    data: { isEnabled },
  });
}

// Delete a rule and its execution history.
export async function deleteAutomationRule({
  organizationId,
  ruleId,
}) {
  const existing = await getAutomationRule({ organizationId, ruleId });

  await prisma.automationRule.delete({
    where: { id: existing.id },
  });

  return { id: existing.id, deleted: true };
}

async function executeAction(tx, rule, event) {
  const organizationId = rule.organizationId;
  const config = rule.actionConfig;

  if (rule.actionType === "CREATE_TASK") {
    const assignedToId = await resolveTaskAssignee(
      tx,
      organizationId,
      config,
      event,
    );

    const dueDate =
      config.dueInHours !== undefined
        ? new Date(Date.now() + config.dueInHours * 60 * 60 * 1000)
        : null;

    const task = await tx.task.create({
      data: {
        title: config.title.trim(),
        description: config.description || null,
        dueDate,
        organizationId,
        assignedToId,
      },
    });

    return { taskId: task.id };
  }

  if (rule.actionType === "SEND_NOTIFICATION") {
    const userIds = await resolveNotificationRecipients(
      tx,
      organizationId,
      config,
      event,
    );

    if (userIds.length === 0) {
      return { skipped: true, reason: "No eligible recipients." };
    }

    await tx.notification.createMany({
      data: userIds.map((userId) => ({
        type: config.notificationType || "SYSTEM",
        title: config.title.trim(),
        message: config.message,
        organizationId,
        userId,
        entityType: event.entityType || null,
        entityId: event.entityId || null,
      })),
    });

    return { notificationsCreated: userIds.length };
  }

  throw httpError("Unsupported automation action.");
}

async function executeOneRule(rule, event) {
  const eventKey = String(event.eventKey);

  let execution;

  try {
    execution = await prisma.automationExecution.create({
      data: {
        eventKey,
        status: "RUNNING",
        organizationId: rule.organizationId,
        ruleId: rule.id,
        context: {
          trigger: event.trigger,
          entityType: event.entityType || null,
          entityId: event.entityId || null,
        },
      },
    });
  } catch (error) {
    // A unique constraint collision means this rule already processed
    // this event. Do not repeat its action.
    if (error.code === "P2002") {
      return { ruleId: rule.id, status: "SKIPPED", reason: "Duplicate event." };
    }

    throw error;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const actionResult = await executeAction(tx, rule, event);

      const status = actionResult.skipped ? "SKIPPED" : "SUCCESS";

      await tx.automationExecution.update({
        where: { id: execution.id },
        data: {
          status,
          completedAt: new Date(),
          context: {
            trigger: event.trigger,
            entityType: event.entityType || null,
            entityId: event.entityId || null,
            result: actionResult,
          },
        },
      });

      return { ruleId: rule.id, status, ...actionResult };
    });

    return result;
  } catch (error) {
    // Keep a record of failures so an administrator can inspect them.
    try {
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: "FAILED",
          errorMessage: String(error.message || "Automation failed").slice(
            0,
            5000,
          ),
          completedAt: new Date(),
        },
      });
    } catch (loggingError) {
      console.error("Failed to record automation failure:", loggingError);
    }

    return {
      ruleId: rule.id,
      status: "FAILED",
      error: error.message || "Automation failed",
    };
  }
}

// Called by CRM modules when an event occurs.
export async function triggerAutomations({
  organizationId,
  trigger,
  eventKey,
  entityType,
  entityId,
  actorId = null,
  assignedToId = null,
  ...eventData
}) {
  if (!organizationId) throw httpError("organizationId is required.");
  if (!TRIGGERS.includes(trigger)) {
    throw httpError("Invalid automation trigger.");
  }
  if (!eventKey || typeof eventKey !== "string" || eventKey.length > 191) {
    throw httpError("eventKey must be a non-empty string (max 191 chars).");
  }

  const rules = await prisma.automationRule.findMany({
    where: {
      organizationId,
      trigger,
      isEnabled: true,
    },
  });

  const event = {
    ...eventData,
    trigger,
    eventKey,
    entityType,
    entityId,
    actorId,
    assignedToId,
  };

  const results = [];

  for (const rule of rules) {
    if (!matchesConditions(rule.conditions, event)) {
      results.push({
        ruleId: rule.id,
        status: "SKIPPED",
        reason: "Conditions did not match.",
      });
      continue;
    }

    results.push(await executeOneRule(rule, event));
  }

  return {
    trigger,
    matchedRules: rules.length,
    results,
  };
}

// View execution history for an organization.
export async function listAutomationExecutions({
  organizationId,
  query = {},
}) {
  const { page, limit, skip } = getPagination(query);

  if (query.status && !STATUSES.includes(query.status)) {
    throw httpError("Invalid execution status.");
  }

  const where = {
    organizationId,
    ...(query.ruleId && { ruleId: query.ruleId }),
    ...(query.status && { status: query.status }),
  };

  const [executions, total] = await prisma.$transaction([
    prisma.automationExecution.findMany({
      where,
      include: {
        rule: {
          select: { id: true, name: true, trigger: true, actionType: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.automationExecution.count({ where }),
  ]);

  return {
    data: executions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
