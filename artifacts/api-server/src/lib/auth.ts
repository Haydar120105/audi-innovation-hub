import type { Request, Response, NextFunction } from "express";

/** True when real Clerk keys are configured. */
const CLERK_ENABLED =
  !!process.env["CLERK_PUBLISHABLE_KEY"] &&
  !!process.env["CLERK_SECRET_KEY"] &&
  !process.env["CLERK_PUBLISHABLE_KEY"]?.includes("REPLACE_ME") &&
  !process.env["CLERK_SECRET_KEY"]?.includes("REPLACE_ME");

// Lazily import getAuth so the module doesn't crash at startup when Clerk is disabled.
async function getClerkAuth(req: Request) {
  if (!CLERK_ENABLED) return { userId: null, sessionClaims: null };
  const { getAuth } = await import("@clerk/express");
  return getAuth(req);
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

/** Require audi_staff role. Returns 403 if not.
 *  When Clerk is not configured (dev without keys), this is a no-op. */
export async function requireAudiStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!CLERK_ENABLED) { next(); return; }
  const { getAuth } = await import("@clerk/express");
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const meta = auth.sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
  if (meta?.["role"] !== "audi_staff") {
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

/** Returns true if the authenticated user has the audi_staff role. */
export function isAudiStaff(req: Request): boolean {
  if (!CLERK_ENABLED) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuth } = require("@clerk/express") as typeof import("@clerk/express");
    const auth = getAuth(req);
    const meta = auth.sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
    return meta?.["role"] === "audi_staff";
  } catch {
    return false;
  }
}

/** Require superuser role. Returns 403 if not. */
export async function requireSuperuser(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!CLERK_ENABLED) { next(); return; }
  const { getAuth } = await import("@clerk/express");
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const meta = auth.sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
  if (meta?.["role"] !== "superuser") {
    res.status(403).json({ error: "Access restricted to superusers." });
    return;
  }
  next();
}

/** Returns true if the authenticated user has the superuser role. */
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
