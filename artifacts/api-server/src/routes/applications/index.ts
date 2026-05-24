import { Router, type IRouter } from "express";
import { eq, desc, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, applicationsTable } from "@workspace/db";
import {
  SubmitApplicationBody,
  GetApplicationParams,
  TrackApplicationParams,
  UpdateApplicationBody,
} from "@workspace/api-zod";
import { analyzeApplication } from "./analyze";
import { requireAuth, requireAudiStaff, getUserId, isAudiStaff } from "../../lib/auth";

const router: IRouter = Router();

// POST /applications — requires sign-in; stores clerkUserId
router.post("/applications", requireAuth, async (req, res): Promise<void> => {
  const parsed = SubmitApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { companyName, website, stage, teamSize, transcript } = parsed.data;
  const clerkUserId = getUserId(req);

  const [app] = await db
    .insert(applicationsTable)
    .values({
      companyName,
      website: website ?? null,
      stage: stage ?? null,
      teamSize: teamSize ?? null,
      transcript: transcript as unknown as Record<string, unknown>[],
      status: "pending",
      trackingToken: randomUUID(),
      clerkUserId,
    })
    .returning();

  req.log.info({ id: app.id, companyName }, "Application saved, starting AI analysis");

  try {
    const analysis = await analyzeApplication(
      transcript as Array<{ role: string; content: string }>,
      companyName,
    );

    const [updated] = await db
      .update(applicationsTable)
      .set({
        structuredData: analysis.structuredData as unknown as Record<string, unknown>,
        departmentScores: analysis.departmentScores as unknown as Record<string, unknown>[],
        businessCases: analysis.businessCases as unknown as Record<string, unknown>[],
        status: "routed",
      })
      .where(eq(applicationsTable.id, app.id))
      .returning();

    req.log.info({ id: app.id }, "AI analysis complete and saved");
    res.status(201).json(updated);
  } catch (err) {
    req.log.error({ err, id: app.id }, "AI analysis failed");
    res.status(201).json(app);
  }
});

// GET /applications — audi_staff/superuser sees all; applicants see only their own
router.get("/applications", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;

  // Check role via Clerk API (fresh — JWT claims don't include publicMetadata by default)
  const { clerkClient } = await import("@clerk/express");
  const clerkUser = await clerkClient.users.getUser(userId);
  const role = clerkUser.publicMetadata?.["role"] as string | undefined;
  const isStaffOrAdmin = role === "audi_staff" || role === "superuser";

  if (isStaffOrAdmin) {
    const apps = await db
      .select()
      .from(applicationsTable)
      .orderBy(desc(applicationsTable.createdAt));
    res.json(apps);
    return;
  }

  // Applicant: only their own submissions
  const apps = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.clerkUserId, userId))
    .orderBy(desc(applicationsTable.createdAt));
  res.json(apps);
});

// GET /applications/track/:token — public
router.get("/applications/track/:token", async (req, res): Promise<void> => {
  const params = TrackApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.trackingToken, params.data.token));

  if (!app) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  res.json({
    companyName: app.companyName,
    status: app.status,
    createdAt: app.createdAt,
    departmentScores: app.departmentScores,
  });
});

// GET /applications/:id — audi_staff or owner
router.get("/applications/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id));

  if (!app) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  // Non-staff can only see their own application
  const ownerId = getUserId(req);
  const { clerkClient } = await import("@clerk/express");
  const clerkUser = await clerkClient.users.getUser(ownerId!);
  const role = clerkUser.publicMetadata?.["role"] as string | undefined;
  if (role !== "audi_staff" && role !== "superuser" && app.clerkUserId !== ownerId) {
    res.status(403).json({ error: "Access denied." });
    return;
  }

  res.json(app);
});

// PATCH /applications/:id — audi_staff only (replaces DEPARTMENT_WRITE_SECRET)
router.patch("/applications/:id", requireAudiStaff, async (req, res): Promise<void> => {
  const params = GetApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateApplicationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (body.data.status !== undefined) updates.status = body.data.status;
  if (body.data.notes !== undefined) updates.notes = body.data.notes;
  if (body.data.rating !== undefined) updates.rating = body.data.rating;
  if (body.data.nextStep !== undefined) updates.nextStep = body.data.nextStep;
  if (body.data.requirements !== undefined) updates.requirements = body.data.requirements;
  if (body.data.milestones !== undefined) updates.milestones = body.data.milestones;
  if (body.data.kpis !== undefined) updates.kpis = body.data.kpis;
  if (body.data.assignedEmployee !== undefined) updates.assignedEmployee = body.data.assignedEmployee;
  if (body.data.ndaStatus !== undefined) updates.ndaStatus = body.data.ndaStatus;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(applicationsTable)
    .set(updates)
    .where(eq(applicationsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  req.log.info({ id: updated.id, ...updates }, "Application updated");
  res.json(updated);
});

export default router;
