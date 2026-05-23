/**
 * Audi Innovation Hub — Test Data Seed
 * ─────────────────────────────────────
 * Erstellt:
 *   • 2 Clerk-Test-User  (applicant + audi_staff)
 *   • 8 Bewerbungen in verschiedenen Status mit realistischen AI-Analyse-Daten
 *
 * Ausführen:
 *   cd scripts && pnpm seed
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env ─────────────────────────────────────────────────────────────────
function loadEnv(file: string) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* ignore */ }
}
loadEnv(resolve(__dirname, "../artifacts/api-server/.env"));

const DATABASE_URL = process.env.DATABASE_URL!;
const CLERK_SECRET = process.env.CLERK_SECRET_KEY!;
const CLERK_API    = "https://api.clerk.com/v1";

if (!DATABASE_URL) throw new Error("DATABASE_URL not found");
if (!CLERK_SECRET)  throw new Error("CLERK_SECRET_KEY not found");

// ── Clerk REST helpers ────────────────────────────────────────────────────────
async function clerkFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json() as T;
  if (!res.ok) throw new Error(`Clerk ${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

interface ClerkUser { id: string; public_metadata?: Record<string,unknown> }

async function upsertClerkUser(opts: {
  email: string; password: string;
  firstName: string; lastName: string;
  role: string | null;
}): Promise<string> {
  const list = await clerkFetch<ClerkUser[]>(`/users?email_address=${encodeURIComponent(opts.email)}&limit=1`);
  if (list[0]) {
    const u = list[0];
    console.log(`  ✓ Exists    ${opts.email}  (${u.id})`);
    if ((u.public_metadata?.["role"] ?? null) !== opts.role) {
      await clerkFetch(`/users/${u.id}/metadata`, {
        method: "PATCH",
        body: JSON.stringify({ public_metadata: { role: opts.role } }),
      });
      console.log(`    → role → "${opts.role ?? "none"}"`);
    }
    return u.id;
  }
  // username derived from email local-part, made safe for Clerk (only alphanumeric + underscores)
  const username = opts.email.split("@")[0]!.replace(/[^a-zA-Z0-9_]/g, "_");
  const created = await clerkFetch<ClerkUser>("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [opts.email],
      username,
      password: opts.password,
      first_name: opts.firstName,
      last_name: opts.lastName,
      public_metadata: { role: opts.role },
      skip_password_checks: true,
      skip_password_requirement: true,
    }),
  });
  console.log(`  ✦ Created   ${opts.email}  (${created.id})`);
  return created.id;
}

// ── Department score builder ───────────────────────────────────────────────────
const DEPTS = [
  { id: "production", name: "Production & Manufacturing" },
  { id: "rd",         name: "Research & Development"     },
  { id: "design",     name: "Design Studio"              },
  { id: "logistics",  name: "Logistics & Supply Chain"   },
  { id: "sales",      name: "Sales & Customer Experience"},
  { id: "digital",    name: "Digital & IT"               },
];

const J: Record<string, Record<"h"|"m"|"l", string>> = {
  production: { h:"Directly applicable to Audi's assembly lines — proven integration with industrial IoT stacks.", m:"Technology could be adapted for shop-floor automation with further customisation.", l:"Limited applicability to production processes at current maturity level." },
  rd:         { h:"Deep-tech core with strong IP alignment to next-gen vehicle development programmes.", m:"Relevant R&D overlap; potential for joint PoC in simulation environments.", l:"Early-stage research; insufficient readiness for near-term R&D integration." },
  design:     { h:"Innovative HMI tooling that could accelerate Audi Design Studio workflows.", m:"Some design-process relevance, especially around AR prototyping.", l:"Minimal overlap with Design Studio's current technology roadmap." },
  logistics:  { h:"Real-time supply-chain intelligence with demonstrated automotive-tier-1 deployments.", m:"Fleet optimisation applicable to inbound logistics with modest integration effort.", l:"Relevance limited to generic warehouse automation use cases." },
  sales:      { h:"AI-driven personalisation fits premium retail strategy and connected-car revenue streams.", m:"CRM enhancement potential, particularly for used-car and aftersales channels.", l:"Primary value lies in back-office rather than customer-facing processes." },
  digital:    { h:"Cloud-native, zero-trust architecture maps directly to Audi's connected-enterprise blueprint.", m:"Useful data-platform component; integration complexity manageable.", l:"Overlap with existing in-house tooling; limited incremental value." },
};

function buildScores(vals: [number,number,number,number,number,number]) {
  return DEPTS.map((d, i) => {
    const score = vals[i]!;
    const tier  = score >= 70 ? "h" : score >= 40 ? "m" : "l";
    return { departmentId: d.id, departmentName: d.name, score, justification: J[d.id]![tier] };
  });
}

function buildBiz(scores: ReturnType<typeof buildScores>, briefs: Record<string,string>) {
  return [...scores].sort((a,b) => b.score - a.score).slice(0,2).map(s => ({
    departmentId: s.departmentId, departmentName: s.departmentName,
    brief: briefs[s.departmentId] ?? `${s.departmentName} pilot opportunity.`,
  }));
}

// ── DB insert ─────────────────────────────────────────────────────────────────
const { Pool } = pg;

let pool: pg.Pool;

async function insertApp(input: {
  clerkUserId?: string|null; companyName: string; website?: string|null;
  stage?: string|null; teamSize?: string|null;
  status: "pending"|"routed"|"shortlisted"|"accepted"|"declined"|"archived";
  createdDaysAgo?: number;
  scoreVals?: [number,number,number,number,number,number];
  briefs?: Record<string,string>;
  notes?: string|null; rating?: number|null; nextStep?: string|null;
  requirements?: unknown; milestones?: unknown; kpis?: unknown;
}) {
  const { rows: ex } = await pool.query(
    "SELECT id FROM applications WHERE company_name = $1 LIMIT 1",
    [input.companyName],
  );
  if (ex.length) { console.log(`  ↩  Skip    "${input.companyName}"`); return; }

  const scoreArr = input.scoreVals ? buildScores(input.scoreVals) : null;
  const bizArr   = scoreArr && input.briefs ? buildBiz(scoreArr, input.briefs) : null;
  const sd       = scoreArr ? { companyName: input.companyName, stage: input.stage, teamSize: input.teamSize } : null;

  await pool.query(
    `INSERT INTO applications
      (id, created_at, status, company_name, website, stage, team_size,
       transcript, structured_data, department_scores, business_cases,
       tracking_token, notes, clerk_user_id,
       rating, next_step, requirements, milestones, kpis)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [
      randomUUID(),
      new Date(Date.now() - (input.createdDaysAgo ?? 0) * 86_400_000),
      input.status,
      input.companyName,
      input.website   ?? null,
      input.stage     ?? null,
      input.teamSize  ?? null,
      "[]",                                          // transcript
      sd   ? JSON.stringify(sd)       : null,        // structured_data
      scoreArr ? JSON.stringify(scoreArr) : null,    // department_scores
      bizArr   ? JSON.stringify(bizArr)   : null,    // business_cases
      randomUUID(),                                  // tracking_token
      input.notes     ?? null,
      input.clerkUserId ?? null,
      input.rating    ?? null,
      input.nextStep  ?? null,
      input.requirements ? JSON.stringify(input.requirements) : null,
      input.milestones   ? JSON.stringify(input.milestones)   : null,
      input.kpis         ? JSON.stringify(input.kpis)         : null,
    ],
  );
  console.log(`  ✦ Inserted "${input.companyName}"  [${input.status}]`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🌱  Audi Innovation Hub — Seed\n");

  // ── 1. Clerk users ──────────────────────────────────────────────────────────
  console.log("1/3  Clerk-User …");

  const applicantId = await upsertClerkUser({
    email:"anna.mueller@startup-demo.io", password:"Demo#Applicant2026!",
    firstName:"Anna", lastName:"Müller", role:"applicant",
  });
  await upsertClerkUser({
    email:"felix.braun@audi-demo.de", password:"Demo#Staff2026!",
    firstName:"Felix", lastName:"Braun", role:"audi_staff",
  });

  console.log();
  console.log("2/3  DB-Verbindung …");
  pool = new Pool({ connectionString: DATABASE_URL });
  console.log("  ✓ OK\n");

  console.log("3/3  Bewerbungen …");

  // ── Anna Müller (Applikant) ─────────────────────────────────────────────────
  await insertApp({
    clerkUserId: applicantId, companyName:"EcoSense AI",
    website:"https://ecosense.ai", stage:"Series A", teamSize:"28",
    status:"shortlisted", createdDaysAgo:18,
    scoreVals:[87,78,22,42,35,61],
    briefs:{
      production:"EcoSense AI's anomaly detection reduced unplanned downtime by 34% at two Tier-1 suppliers. A Neckarsulm BIW pilot via OPC-UA is feasible in 6 weeks.",
      rd:"Sub-2ms edge inference directly relevant to Audi R&D's sensor-fusion programmes. Joint sprint on predictive battery degradation is a natural first step.",
    },
    notes:"CTO ex-Siemens Industrial AI. 4 granted patents. Strong technical team.",
    rating:4, nextStep:"Schedule technical deep-dive with Production Engineering",
    requirements:[
      {id:randomUUID(),text:"Technical due diligence report",done:true},
      {id:randomUUID(),text:"GDPR & data residency compliance brief",done:true},
      {id:randomUUID(),text:"Reference call with existing customer",done:false},
      {id:randomUUID(),text:"IP ownership clarification (patent 3)",done:false},
    ],
    milestones:[
      {id:randomUUID(),title:"Initial demo & Q&A",dueDate:"2026-04-10",status:"done"},
      {id:randomUUID(),title:"Technical architecture review",dueDate:"2026-05-02",status:"done"},
      {id:randomUUID(),title:"Neckarsulm pilot kick-off",dueDate:"2026-07-01",status:"in_progress"},
      {id:randomUUID(),title:"Pilot results & go/no-go",dueDate:"2026-09-15",status:"pending"},
    ],
    kpis:[
      {id:randomUUID(),metric:"Unplanned downtime reduction",target:"30",current:"22",unit:"%"},
      {id:randomUUID(),metric:"Alert false-positive rate",target:"<5",current:"7",unit:"%"},
      {id:randomUUID(),metric:"Integration timeline",target:"6",current:"5",unit:"weeks"},
    ],
  });

  await insertApp({
    clerkUserId:applicantId, companyName:"FleetBrainz",
    website:"https://fleetbrainz.io", stage:"Seed", teamSize:"9",
    status:"routed", createdDaysAgo:5,
    scoreVals:[38,55,18,70,58,75],
    briefs:{
      digital:"ML dispatch optimiser reduced deadhead mileage 18% in a 200-vehicle fleet. Ingolstadt campus test fleet is an ideal pilot — estimated €280k annual saving.",
      logistics:"Real-time rerouting via REST replaces manual allocation for inbound parts delivery in 4 months.",
    },
  });

  await insertApp({
    clerkUserId:applicantId, companyName:"GridPulse Energy",
    website:"https://gridpulse.energy", stage:"Pre-Seed", teamSize:"5",
    status:"declined", createdDaysAgo:45,
    scoreVals:[28,51,8,15,12,44],
    briefs:{
      rd:"Early-stage analytics with limited automotive-grade validation. Candidate for R&D exploration grant pending IP development.",
      digital:"Visualisation layer replicates existing BMS dashboard capabilities.",
    },
    notes:"Team academically strong but lacks commercial traction. Encourage reapplication after Series A.",
    rating:2, nextStep:"Closed — encourage reapplication in 12 months",
  });

  // ── Staff-visible (no owner) ────────────────────────────────────────────────
  await insertApp({
    companyName:"NeuralDrive Systems", website:"https://neuraldrive.systems",
    stage:"Series B", teamSize:"62",
    status:"routed", createdDaysAgo:3,
    scoreVals:[55,94,30,20,28,82],
    briefs:{
      rd:"4D LiDAR fusion at 120Hz — directly relevant to Audi Level-3 motorway pilot. IP licencing or acqui-hire is a viable strategic option.",
      digital:"SOTIF-compliant OTA model update pipeline could be white-labelled for VGP's software-defined-vehicle platform.",
    },
  });

  await insertApp({
    companyName:"SynthCore Materials", website:"https://synthcore.io",
    stage:"Series A", teamSize:"34",
    status:"shortlisted", createdDaysAgo:22,
    scoreVals:[79,88,18,32,14,40],
    briefs:{
      rd:"Bio-composite panels at FMVSS 201 with 23% weight reduction vs. aluminium — directly applicable to Q-series. JDA on next-gen hood & door panels recommended.",
      production:"Compatible with existing press lines. Retrofit ~€1.2M, break-even 14 months.",
    },
    notes:"CEO has existing relationship with Audi Lightweight Centre. Proceed to JDA term-sheet.",
    rating:5, nextStep:"Initiate JDA term-sheet with Procurement",
    requirements:[
      {id:randomUUID(),text:"Material test reports (FMVSS + ECE-R)",done:true},
      {id:randomUUID(),text:"Production scalability audit",done:true},
      {id:randomUUID(),text:"Environmental LCA",done:false},
      {id:randomUUID(),text:"JDA term-sheet review by legal",done:false},
    ],
    milestones:[
      {id:randomUUID(),title:"Sample delivery & lab testing",dueDate:"2026-03-28",status:"done"},
      {id:randomUUID(),title:"Press-tool compatibility assessment",dueDate:"2026-05-14",status:"done"},
      {id:randomUUID(),title:"Small-series trial (50 parts)",dueDate:"2026-08-20",status:"in_progress"},
      {id:randomUUID(),title:"JDA signature",dueDate:"2026-10-01",status:"pending"},
    ],
    kpis:[
      {id:randomUUID(),metric:"Weight reduction vs. aluminium",target:"20",current:"23",unit:"%"},
      {id:randomUUID(),metric:"Cost delta vs. steel",target:"<15",current:"12",unit:"%"},
      {id:randomUUID(),metric:"Crash test pass rate",target:"100",current:"100",unit:"%"},
    ],
  });

  await insertApp({
    companyName:"AutoVision Labs", website:"https://autovision.ai",
    stage:"Series A", teamSize:"41",
    status:"accepted", createdDaysAgo:60,
    scoreVals:[91,83,45,28,38,77],
    briefs:{
      production:"4K@60fps defect detection at 99.2% accuracy in paint-shop — surpassing QA thresholds. BIW Line 3 replacement projects €3.4M annual saving.",
      rd:"Foundation model fine-tunable on Audi defect taxonomy in 2 weeks. IP cleanly licensed.",
    },
    notes:"Contract signed. Live on Ingolstadt BIW Line 3 since March 2026.",
    rating:5, nextStep:"Expand to Paint Shop Line 1 — procurement order raised",
    requirements:[
      {id:randomUUID(),text:"Cybersecurity pen-test (OT network)",done:true},
      {id:randomUUID(),text:"VW Group supplier self-assessment (SCC)",done:true},
      {id:randomUUID(),text:"CE marking for vision hardware",done:true},
      {id:randomUUID(),text:"5-year SLA + maintenance contract",done:true},
    ],
    milestones:[
      {id:randomUUID(),title:"PoC BIW Line 3 (shadowed)",dueDate:"2026-01-15",status:"done"},
      {id:randomUUID(),title:"6-week parallel run",dueDate:"2026-02-28",status:"done"},
      {id:randomUUID(),title:"Full handover — BIW Line 3 live",dueDate:"2026-03-10",status:"done"},
      {id:randomUUID(),title:"Paint Shop Line 1 integration",dueDate:"2026-07-01",status:"in_progress"},
    ],
    kpis:[
      {id:randomUUID(),metric:"Defect detection accuracy",target:"99",current:"99.4",unit:"%"},
      {id:randomUUID(),metric:"False rejection rate",target:"<1",current:"0.3",unit:"%"},
      {id:randomUUID(),metric:"Manual inspection FTE saved",target:"12",current:"14",unit:"FTE"},
      {id:randomUUID(),metric:"Annual saving BIW Line 3",target:"3.4",current:"3.6",unit:"M€"},
    ],
  });

  await insertApp({
    companyName:"UrbanFlow Mobility", website:"https://urbanflow.mobi",
    stage:"Seed", teamSize:"12",
    status:"pending", createdDaysAgo:1,
  });

  await insertApp({
    companyName:"QuantumShield Security", website:"https://quantumshield.io",
    stage:"Series A", teamSize:"29",
    status:"shortlisted", createdDaysAgo:12,
    scoreVals:[18,71,12,22,15,89],
    briefs:{
      digital:"Post-quantum crypto stack certified BSI TR-03116-4 — essential for Audi's OTA backend by 2027 EU mandate. 3-month pilot on Connect infrastructure recommended.",
      rd:"HSM integration roadmap aligns with next-gen E/E architecture. Co-development on quantum-safe key exchange is a strategic fit.",
    },
    notes:"Cleared preliminary TISAX assessment. DPA under legal review.",
    rating:4, nextStep:"Finalise TISAX Level 2 scope and schedule on-site assessment",
    requirements:[
      {id:randomUUID(),text:"TISAX Level 2 audit scope confirmation",done:true},
      {id:randomUUID(),text:"Pen test on pilot environment",done:false},
      {id:randomUUID(),text:"Data processing agreement (DPA)",done:false},
    ],
  });

  await pool.end();

  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  🏁  Seed abgeschlossen                                              ║
╠══════════════════════════════════════════════════════════════════════╣
║  APPLIKANT                                                           ║
║    E-Mail:   anna.mueller@startup-demo.io                            ║
║    Passwort: Demo#Applicant2026!                                     ║
║    Apps:     EcoSense AI (shortlisted)                               ║
║              FleetBrainz (routed / under analysis)                   ║
║              GridPulse Energy (declined)                             ║
╠══════════════════════════════════════════════════════════════════════╣
║  AUDI STAFF                                                          ║
║    E-Mail:   felix.braun@audi-demo.de                                ║
║    Passwort: Demo#Staff2026!                                         ║
║    Sieht:    Alle 8 Bewerbungen + Department Portal                  ║
╠══════════════════════════════════════════════════════════════════════╣
║  SUPERUSER (du — Haydar Selman)                                      ║
║    Sieht:    Command Center + Alle 8 Bewerbungen + User Management   ║
╚══════════════════════════════════════════════════════════════════════╝
`);
}

main().catch((err: unknown) => {
  console.error("\n❌ Seed fehlgeschlagen:", (err as Error).message);
  process.exit(1);
});
