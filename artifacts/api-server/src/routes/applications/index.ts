import { Router, type IRouter } from "express";
import { eq, desc, or, sql } from "drizzle-orm";
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

// GET /applications
//   superuser  → all applications
//   audi_staff → only applications where assignedEmployee.clerkId = their userId
//   applicant  → only their own submissions
router.get("/applications", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;

  const { createClerkClient } = await import("@clerk/express");
  const clerkUser = await createClerkClient({ secretKey: process.env["CLERK_SECRET_KEY"] }).users.getUser(userId);
  const role = clerkUser.publicMetadata?.["role"] as string | undefined;

  if (role === "superuser") {
    // Superuser sees everything
    const apps = await db
      .select()
      .from(applicationsTable)
      .orderBy(desc(applicationsTable.createdAt));
    res.json(apps);
    return;
  }

  if (role === "audi_staff") {
    // Staff only sees applications assigned to them via assignedEmployee.clerkId
    const apps = await db
      .select()
      .from(applicationsTable)
      .where(sql`${applicationsTable.assignedEmployee}->>'clerkId' = ${userId}`)
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

  const ownerId = getUserId(req)!;
  const { createClerkClient } = await import("@clerk/express");
  const clerkUser = await createClerkClient({ secretKey: process.env["CLERK_SECRET_KEY"] }).users.getUser(ownerId);
  const role = clerkUser.publicMetadata?.["role"] as string | undefined;

  if (role === "superuser") {
    // Superuser can see any application
  } else if (role === "audi_staff") {
    // Staff can only access applications assigned to them
    const assignedClerkId = (app.assignedEmployee as Record<string, unknown> | null)?.["clerkId"] as string | undefined;
    if (assignedClerkId !== ownerId) {
      res.status(403).json({ error: "Access denied. This application is not assigned to you." });
      return;
    }
  } else if (app.clerkUserId !== ownerId) {
    // Regular user can only see their own application
    res.status(403).json({ error: "Access denied." });
    return;
  }

  res.json(app);
});

// PATCH /applications/:id — audi_staff (only their assigned apps) or superuser
router.patch("/applications/:id", requireAudiStaff, async (req, res): Promise<void> => {
  const params = GetApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Permission check: staff may only patch their own assigned applications
  const patcherId = getUserId(req)!;
  const { createClerkClient: cc2 } = await import("@clerk/express");
  const patcherUser = await cc2({ secretKey: process.env["CLERK_SECRET_KEY"] }).users.getUser(patcherId);
  const patcherRole = patcherUser.publicMetadata?.["role"] as string | undefined;

  if (patcherRole === "audi_staff") {
    const [existing] = await db
      .select({ assignedEmployee: applicationsTable.assignedEmployee })
      .from(applicationsTable)
      .where(eq(applicationsTable.id, params.data.id));
    const assignedClerkId = (existing?.assignedEmployee as Record<string, unknown> | null)?.["clerkId"] as string | undefined;
    if (assignedClerkId !== patcherId) {
      res.status(403).json({ error: "Access denied. This application is not assigned to you." });
      return;
    }
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
