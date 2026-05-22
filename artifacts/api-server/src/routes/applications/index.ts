import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, applicationsTable } from "@workspace/db";
import {
  SubmitApplicationBody,
  GetApplicationParams,
  TrackApplicationParams,
  UpdateApplicationBody,
} from "@workspace/api-zod";
import { analyzeApplication } from "./analyze";

const router: IRouter = Router();

router.post("/applications", async (req, res): Promise<void> => {
  const parsed = SubmitApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { companyName, website, stage, teamSize, transcript } = parsed.data;

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

router.get("/applications", async (req, res): Promise<void> => {
  const apps = await db
    .select()
    .from(applicationsTable)
    .orderBy(desc(applicationsTable.createdAt));

  res.json(apps);
});

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

router.get("/applications/:id", async (req, res): Promise<void> => {
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

  res.json(app);
});

router.patch("/applications/:id", async (req, res): Promise<void> => {
  const secret = process.env["DEPARTMENT_WRITE_SECRET"];
  if (!secret) {
    res.status(503).json({ error: "Department write access is not configured on this server." });
    return;
  }
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || token !== secret) {
    res.status(401).json({ error: "Unauthorized. A valid department key is required." });
    return;
  }

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
