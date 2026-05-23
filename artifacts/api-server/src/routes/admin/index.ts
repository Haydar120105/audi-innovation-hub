import { Router, type IRouter } from "express";
import { requireSuperuser, CLERK_ENABLED } from "../../lib/auth";

const VALID_ROLES = new Set(["superuser", "audi_staff", "applicant", ""]);

const router: IRouter = Router();

/** GET /admin/users — list all Clerk users with their role */
router.get("/admin/users", requireSuperuser, async (_req, res): Promise<void> => {
  if (!CLERK_ENABLED) {
    res.json([]);
    return;
  }

  const { clerkClient } = await import("@clerk/express");

  const response = await clerkClient.users.getUserList({ limit: 500, orderBy: "-created_at" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = response.data.map((u: any) => ({
    id: u.id,
    email: u.emailAddresses?.[0]?.emailAddress ?? "",
    firstName: u.firstName ?? "",
    lastName: u.lastName ?? "",
    imageUrl: u.imageUrl ?? "",
    createdAt: u.createdAt,
    role: (u.publicMetadata?.["role"] as string | undefined) ?? null,
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

  const { clerkClient } = await import("@clerk/express");

  const newRole = role || null;

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: { role: newRole },
  });

  res.json({ ok: true, userId, role: newRole });
});

/** DELETE /admin/users/:userId — remove a user from Clerk */
router.delete("/admin/users/:userId", requireSuperuser, async (req, res): Promise<void> => {
  const { userId } = req.params;

  if (!CLERK_ENABLED) {
    res.json({ ok: true });
    return;
  }

  const { clerkClient } = await import("@clerk/express");

  await clerkClient.users.deleteUser(userId);
  res.json({ ok: true, userId });
});

export default router;
