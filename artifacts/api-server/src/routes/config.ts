import { Router } from "express";
import { db, hubConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DEFAULT_FOCUS_AREAS } from "./hub-config-defaults";

const router = Router();

/**
 * GET /config — public, no auth required.
 * Returns the focus areas for the homepage.
 * Falls back to hardcoded defaults if the DB has no override.
 */
router.get("/config", async (_req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(hubConfigTable)
      .where(eq(hubConfigTable.key, "focus_areas"));

    res.json({
      focusAreas: row ? row.value : DEFAULT_FOCUS_AREAS,
    });
  } catch {
    // DB unavailable → return hardcoded defaults silently
    res.json({ focusAreas: DEFAULT_FOCUS_AREAS });
  }
});

export default router;
