import type { Request, Response, NextFunction } from "express";

/** True when real Clerk keys are configured. */
const CLERK_ENABLED =
  !!process.env["CLERK_PUBLISHABLE_KEY"] &&
  !!process.env["CLERK_SECRET_KEY"] &&
  !process.env["CLERK_PUBLISHABLE_KEY"]?.includes("REPLACE_ME") &&
  !process.env["CLERK_SECRET_KEY"]?.includes("REPLACE_ME");

/**
 * Fetch the role for a given userId directly from Clerk API.
 * This bypasses the JWT session claims (which do NOT include publicMetadata
 * by default unless a custom JWT template is configured) and always returns
 * fresh metadata from Clerk's source of truth.
 */
async function getRoleFromClerk(userId: string): Promise<string | null> {
  const { clerkClient } = await import("@clerk/express");
  const user = await clerkClient.users.getUser(userId);
  return (user.publicMetadata?.["role"] as string | undefined) ?? null;
}

/** Require a valid Clerk session. Returns 401 if missing.
 *  When Clerk is not configured (dev without keys), this is a no-op. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!CLERK_ENABLED) { next(); return; }
  const { getAuth } = await import("@clerk/express");
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}

/** Require audi_staff OR superuser role. Returns 403 if not.
 *  Uses Clerk API directly (not JWT claims) so no JWT template is required. */
export async function requireAudiStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!CLERK_ENABLED) { next(); return; }
  const { getAuth } = await import("@clerk/express");
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const role = await getRoleFromClerk(auth.userId);
  // superusers can also access staff routes
  if (role !== "audi_staff" && role !== "superuser") {
    res.status(403).json({ error: "Access restricted to Audi staff." });
    return;
  }
  next();
}

/** Returns the Clerk userId from the request, or null if unauthenticated / Clerk disabled. */
export function getUserId(req: Request): string | null {
  if (!CLERK_ENABLED) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuth } = require("@clerk/express") as typeof import("@clerk/express");
    return getAuth(req).userId ?? null;
  } catch {
    return null;
  }
}

/** Returns true if the authenticated user has the audi_staff or superuser role.
 *  NOTE: async — use requireAudiStaff middleware in route handlers instead. */
export function isAudiStaff(req: Request): boolean {
  // This sync helper checks JWT claims as a fast path; for definitive checks use requireAudiStaff.
  if (!CLERK_ENABLED) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuth } = require("@clerk/express") as typeof import("@clerk/express");
    const auth = getAuth(req);
    // Fallback: check JWT claims if present (requires custom JWT template)
    const meta = auth.sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
    return meta?.["role"] === "audi_staff" || meta?.["role"] === "superuser";
  } catch {
    return false;
  }
}

/** Require superuser role. Returns 403 if not.
 *  Uses Clerk API directly (not JWT claims) so no JWT template is required. */
export async function requireSuperuser(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!CLERK_ENABLED) { next(); return; }
  const { getAuth } = await import("@clerk/express");
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const role = await getRoleFromClerk(auth.userId);
  if (role !== "superuser") {
    res.status(403).json({ error: "Access restricted to superusers." });
    return;
  }
  next();
}

/** Returns true if the authenticated user has the superuser role.
 *  NOTE: sync — checks JWT claims only; for definitive checks use requireSuperuser middleware. */
export function isSuperuser(req: Request): boolean {
  if (!CLERK_ENABLED) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuth } = require("@clerk/express") as typeof import("@clerk/express");
    const auth = getAuth(req);
    const meta = auth.sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
    return meta?.["role"] === "superuser";
  } catch {
    return false;
  }
}

export { CLERK_ENABLED };
