import { Router, type IRouter } from "express";
import { createClerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { requireSuperuser, CLERK_ENABLED } from "../../lib/auth";
import { db, hubConfigTable } from "@workspace/db";
import { bustAnalysisPromptCache } from "../applications/analyze";
import {
  DEFAULT_FOCUS_AREAS,
  DEFAULT_FIELD_QUESTIONS,
  DEFAULT_SYSTEM_PROMPT_INTRO,
  DEFAULT_ANALYSIS_PROMPT,
} from "../hub-config-defaults";

const VALID_ROLES = new Set(["superuser", "audi_staff", "applicant", ""]);

const router: IRouter = Router();

function clerk() {
  return createClerkClient({ secretKey: process.env["CLERK_SECRET_KEY"] });
}

/** GET /admin/users — list all Clerk users with their role */
router.get("/admin/users", requireSuperuser, async (_req, res): Promise<void> => {
  if (!CLERK_ENABLED) {
    res.json([]);
    return;
  }

  const response = await clerk().users.getUserList({ limit: 500, orderBy: "-created_at" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = response.data.map((u: any) => ({
    id: u.id,
    email: u.emailAddresses?.[0]?.emailAddress ?? "",
    firstName: u.firstName ?? "",
    lastName: u.lastName ?? "",
    imageUrl: u.imageUrl ?? "",
    createdAt: u.createdAt,
    role: (u.publicMetadata?.["role"] as string | undefined) ?? null,
    departmentId: (u.publicMetadata?.["departmentId"] as string | undefined) ?? null,
    lastSignInAt: u.lastSignInAt ?? null,
  }));

  res.json(users);
});

/** PATCH /admin/users/:userId/role — set or clear a user's role */
router.patch("/admin/users/:userId/role", requireSuperuser, async (req, res): Promise<void> => {
  const { userId } = req.params;
  const { role } = req.body as { role?: string | null };

  if (role !== undefined && role !== null && !VALID_ROLES.has(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: superuser, audi_staff, applicant, or empty string.` });
    return;
  }

  if (!CLERK_ENABLED) {
    res.json({ ok: true });
    return;
  }

  const newRole = role || null;
  await clerk().users.updateUserMetadata(userId, {
    publicMetadata: { role: newRole },
  });

  res.json({ ok: true, userId, role: newRole });
});

/** PATCH /admin/users/:userId/department — set a staff member's persistent department */
router.patch("/admin/users/:userId/department", requireSuperuser, async (req, res): Promise<void> => {
  const { userId } = req.params;
  const { departmentId } = req.body as { departmentId?: string | null };

  if (!CLERK_ENABLED) {
    res.json({ ok: true });
    return;
  }

  const user = await clerk().users.getUser(userId);
  const existingRole = (user.publicMetadata?.["role"] as string | undefined) ?? null;

  await clerk().users.updateUserMetadata(userId, {
    publicMetadata: { role: existingRole, departmentId: departmentId || null },
  });

  res.json({ ok: true, userId, departmentId: departmentId || null });
});

/** DELETE /admin/users/:userId — remove a user from Clerk */
router.delete("/admin/users/:userId", requireSuperuser, async (req, res): Promise<void> => {
  const { userId } = req.params;

  if (!CLERK_ENABLED) {
    res.json({ ok: true });
    return;
  }

  await clerk().users.deleteUser(userId);
  res.json({ ok: true, userId });
});

// ─── Hub Config ───────────────────────────────────────────────────────────────

const ALLOWED_CONFIG_KEYS = new Set(["focus_areas", "chat_questions", "chat_system_prompt", "analysis_prompt"]);

/**
 * GET /admin/config — returns all config keys with defaults filled in for missing rows.
 * Superuser only.
 */
router.get("/admin/config", requireSuperuser, async (_req, res): Promise<void> => {
  const rows = await db.select().from(hubConfigTable);
  const map: Record<string, unknown> = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  res.json({
    focus_areas:        map["focus_areas"]        ?? DEFAULT_FOCUS_AREAS,
    chat_questions:     map["chat_questions"]      ?? DEFAULT_FIELD_QUESTIONS,
    chat_system_prompt: map["chat_system_prompt"]  ?? { intro: DEFAULT_SYSTEM_PROMPT_INTRO },
    analysis_prompt:    map["analysis_prompt"]     ?? DEFAULT_ANALYSIS_PROMPT,
  });
});

/**
 * PUT /admin/config/:key — upsert a single config key.
 * Body: { value: unknown }
 * Superuser only.
 */
router.put("/admin/config/:key", requireSuperuser, async (req, res): Promise<void> => {
  const { key } = req.params;

  if (!ALLOWED_CONFIG_KEYS.has(key)) {
    res.status(400).json({ error: `Unknown config key: "${key}". Allowed: ${[...ALLOWED_CONFIG_KEYS].join(", ")}` });
    return;
  }

  const { value } = req.body as { value?: unknown };
  if (value === undefined) {
    res.status(400).json({ error: "Request body must contain a 'value' field" });
    return;
  }

  const [row] = await db
    .insert(hubConfigTable)
    .values({ key, value: value as unknown as Record<string, unknown> })
    .onConflictDoUpdate({
      target: hubConfigTable.key,
      set: {
        value: value as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Bust in-process caches for keys that have one
  if (key === "analysis_prompt") bustAnalysisPromptCache();

  res.json(row);
});

/**
 * DELETE /admin/config/:key — remove a custom override so the server falls back to its built-in default.
 * Superuser only.
 */
router.delete("/admin/config/:key", requireSuperuser, async (req, res): Promise<void> => {
  const { key } = req.params;

  if (!ALLOWED_CONFIG_KEYS.has(key)) {
    res.status(400).json({ error: `Unknown config key: "${key}"` });
    return;
  }

  await db.delete(hubConfigTable).where(eq(hubConfigTable.key, key));
  if (key === "analysis_prompt") bustAnalysisPromptCache();
  res.json({ ok: true });
});

export default router;
