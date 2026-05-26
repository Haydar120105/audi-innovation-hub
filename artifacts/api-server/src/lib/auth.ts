import type { Request, Response, NextFunction } from "express";

/**
 * True when real Clerk keys are configured.
 * Checked at startup — falls back to open access in local dev without keys.
 */
const CLERK_ENABLED =
  !!process.env["CLERK_SECRET_KEY"] &&
  !process.env["CLERK_SECRET_KEY"]?.includes("REPLACE_ME");

/**
 * Extract and verify a Clerk Bearer token using verifyToken().
 *
 * Uses CLERK_JWT_KEY (PEM public key) for fully offline RS256 verification —
 * no JWKS network call, no latency, no rate limits.
 *
 * Falls back to CLERK_SECRET_KEY if CLERK_JWT_KEY is not set, which triggers
 * a JWKS fetch from Clerk's servers on first use (then cached).
 *
 * NOTE: publishableKey is NOT a valid verifyToken() option — use jwtKey or secretKey.
 * See: https://clerk.com/docs/references/backend/verify-token
 */
async function verifyBearerToken(req: Request): Promise<string | null> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  try {
    const { verifyToken } = await import("@clerk/express");

    const jwtKey = process.env["CLERK_JWT_KEY"];
    const secretKey = process.env["CLERK_SECRET_KEY"];

    const payload = await verifyToken(token, {
      // jwtKey = offline PEM verification (preferred — no network call)
      // secretKey = fallback for JWKS-based verification
      ...(jwtKey ? { jwtKey } : { secretKey }),
    });

    const userId = payload.sub ?? null;

    if (userId) {
      // Populate req.auth so that getAuth(req) works in downstream helpers.
      (req as Request & { auth: unknown }).auth = {
        userId,
        sessionId: (payload as Record<string, unknown>)["sid"] ?? null,
        sessionClaims: payload,
        actor: undefined,
        orgId: undefined,
        orgRole: undefined,
        orgSlug: undefined,
        orgPermissions: undefined,
        factorVerificationAge: null,
        getToken: async () => token,
        has: () => false,
        debug: () => ({}),
      };
    }

    return userId;
  } catch (err) {
    console.error("[auth] verifyToken failed:", (err as Error).message);
    return null;
  }
}

/**
 * Fetch the role for a given userId directly from Clerk API (always fresh).
 * Does NOT rely on JWT session claims — those don't include publicMetadata
 * unless a custom JWT template is configured in the Clerk Dashboard.
 */
async function getRoleFromClerk(userId: string): Promise<string | null> {
  try {
    const { createClerkClient } = await import("@clerk/express");
    const clerk = createClerkClient({ secretKey: process.env["CLERK_SECRET_KEY"] });
    const user = await clerk.users.getUser(userId);
    return (user.publicMetadata?.["role"] as string | undefined) ?? null;
  } catch (err) {
    console.error("[auth] getRoleFromClerk failed:", (err as Error).message);
    return null;
  }
}

/** Require a valid Clerk session. Returns 401 if missing or invalid. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!CLERK_ENABLED) { next(); return; }

  const userId = await verifyBearerToken(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}

/** Require audi_staff OR superuser role. Returns 403 if not. */
export async function requireAudiStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!CLERK_ENABLED) { next(); return; }

  const userId = await verifyBearerToken(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const role = await getRoleFromClerk(userId);
  if (role !== "audi_staff" && role !== "superuser") {
    res.status(403).json({ error: "Access restricted to Audi staff." });
    return;
  }
  next();
}

/** Require superuser role only. Returns 403 if not. */
export async function requireSuperuser(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!CLERK_ENABLED) { next(); return; }

  const userId = await verifyBearerToken(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const role = await getRoleFromClerk(userId);
  if (role !== "superuser") {
    res.status(403).json({ error: "Access restricted to superusers." });
    return;
  }
  next();
}

/** Returns the Clerk userId from req.auth (set by verifyBearerToken), or null. */
export function getUserId(req: Request): string | null {
  if (!CLERK_ENABLED) return null;
  const auth = (req as Request & { auth?: { userId?: string } }).auth;
  return auth?.userId ?? null;
}

/** Sync helper: checks JWT session claims for the role (fast path).
 *  Only works if a custom JWT template includes publicMetadata.role.
 *  For definitive checks, use requireAudiStaff middleware instead. */
export function isAudiStaff(req: Request): boolean {
  if (!CLERK_ENABLED) return false;
  const auth = (req as Request & { auth?: { sessionClaims?: Record<string, unknown> } }).auth;
  const meta = auth?.sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
  return meta?.["role"] === "audi_staff" || meta?.["role"] === "superuser";
}

/** Sync helper: checks JWT session claims for superuser role (fast path). */
export function isSuperuser(req: Request): boolean {
  if (!CLERK_ENABLED) return false;
  const auth = (req as Request & { auth?: { sessionClaims?: Record<string, unknown> } }).auth;
  const meta = auth?.sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
  return meta?.["role"] === "superuser";
}

export { CLERK_ENABLED };
