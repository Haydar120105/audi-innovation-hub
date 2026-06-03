/**
 * Creates 5 Audi Staff + 5 Applicant test users in Clerk.
 * Run: node scripts/create-test-users.mjs
 */
import { createClerkClient } from "@clerk/express";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from api-server
const envPath = join(__dirname, "../artifacts/api-server/.env");
const envContent = readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const CLERK_SECRET_KEY = env["CLERK_SECRET_KEY"];
if (!CLERK_SECRET_KEY) {
  console.error("❌  CLERK_SECRET_KEY not found in .env");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
const PASSWORD = "Testpasswort1-";

const STAFF_USERS = [
  { firstName: "Sophie",    lastName: "Wagner",   email: "sophie.wagner@audi-test.de",   department: "rd"         },
  { firstName: "Markus",    lastName: "Bauer",    email: "markus.bauer@audi-test.de",    department: "design"     },
  { firstName: "Laura",     lastName: "Schmidt",  email: "laura.schmidt@audi-test.de",   department: "digital"    },
  { firstName: "Felix",     lastName: "Hoffmann", email: "felix.hoffmann@audi-test.de",  department: "production" },
  { firstName: "Jana",      lastName: "Klein",    email: "jana.klein@audi-test.de",      department: "sales"      },
];

const APPLICANT_USERS = [
  { firstName: "Tim",       lastName: "Berger",   email: "tim.berger@startup-test.de",   company: "EcoMobility GmbH"      },
  { firstName: "Mia",       lastName: "Schulz",   email: "mia.schulz@startup-test.de",   company: "DataFlow AG"           },
  { firstName: "Leon",      lastName: "Fischer",  email: "leon.fischer@startup-test.de", company: "GreenCharge Solutions" },
  { firstName: "Lena",      lastName: "Weber",    email: "lena.weber@startup-test.de",   company: "SmartFactory Labs"     },
  { firstName: "Noah",      lastName: "Meyer",    email: "noah.meyer@startup-test.de",   company: "AI Logistics Co."      },
];

async function createUser({ firstName, lastName, email, role, extraMeta = {} }) {
  try {
    const user = await clerk.users.createUser({
      firstName,
      lastName,
      emailAddress: [email],
      password: PASSWORD,
      publicMetadata: { role, ...extraMeta },
    });
    console.log(`✅  ${role.padEnd(12)} ${firstName} ${lastName} <${email}>`);
    return user;
  } catch (err) {
    if (err?.errors?.[0]?.code === "form_identifier_exists") {
      console.log(`⚠️   Already exists: ${email}`);
    } else {
      console.error(`❌  Failed ${email}:`, err?.errors?.[0]?.message ?? err.message);
    }
  }
}

console.log("\n🚀  Creating Audi Staff users…\n");
for (const u of STAFF_USERS) {
  await createUser({ ...u, role: "audi_staff", extraMeta: { departmentId: u.department } });
}

console.log("\n🚀  Creating Applicant users…\n");
for (const u of APPLICANT_USERS) {
  await createUser({ ...u, role: "applicant" });
}

console.log("\n✅  Done. Password for all: " + PASSWORD + "\n");
