import { randomBytes } from "node:crypto";

export function createOrganizationSlug(name) {
    const base = name
        .toLowerCase()
        .trim()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 45);

    return `${base || "organization"}-${randomBytes(4).toString("hex")}`;
}