
import {
    createAutomationRule,
    listAutomationRules,
    getAutomationRule,
    updateAutomationRule,
    setAutomationRuleEnabled,
    deleteAutomationRule,
    listAutomationExecutions,
} from "../services/automation.service.js";

function handleError(res, error) {
    const statusCode = error.statusCode || 500;

    if (statusCode === 500) {
        console.error("Automation controller error:", error);
    }

    return res.status(statusCode).json({
        success: false,
        message: statusCode === 500 ? "Internal server error." : error.message,
    });
}

export async function createRule(req, res) {
    try {
        const rule = await createAutomationRule({
            organizationId: req.organization.id,
            input: req.body,
        });

        return res.status(201).json({
            success: true,
            message: "Automation rule created.",
            data: rule,
        });
    } catch (error) {
        return handleError(res, error);
    }
}

export async function getRules(req, res) {
    try {
        const result = await listAutomationRules({
            organizationId: req.organization.id,
            query: req.query,
        });

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (error) {
        return handleError(res, error);
    }
}

export async function getRule(req, res) {
    try {
        const rule = await getAutomationRule({
            organizationId: req.organization.id,
            ruleId: req.params.ruleId,
        });

        return res.status(200).json({
            success: true,
            data: rule,
        });
    } catch (error) {
        return handleError(res, error);
    }
}

export async function updateRule(req, res) {
    try {
        const rule = await updateAutomationRule({
            organizationId: req.organization.id,
            ruleId: req.params.ruleId,
            input: req.body,
        });

        return res.status(200).json({
            success: true,
            message: "Automation rule updated.",
            data: rule,
        });
    } catch (error) {
        return handleError(res, error);
    }
}

export async function toggleRule(req, res) {
    try {
        const rule = await setAutomationRuleEnabled({
            organizationId: req.organization.id,
            ruleId: req.params.ruleId,
            isEnabled: req.body.isEnabled,
        });

        return res.status(200).json({
            success: true,
            message: `Automation rule ${rule.isEnabled ? "enabled" : "disabled"}.`,
            data: rule,
        });
    } catch (error) {
        return handleError(res, error);
    }
}

export async function removeRule(req, res) {
    try {
        const result = await deleteAutomationRule({
            organizationId: req.organization.id,
            ruleId: req.params.ruleId,
        });

        return res.status(200).json({
            success: true,
            message: "Automation rule deleted.",
            data: result,
        });
    } catch (error) {
        return handleError(res, error);
    }
}

export async function getExecutions(req, res) {
    try {
        const result = await listAutomationExecutions({
            organizationId: req.organization.id,
            query: req.query,
        });

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (error) {
        return handleError(res, error);
    }
}
