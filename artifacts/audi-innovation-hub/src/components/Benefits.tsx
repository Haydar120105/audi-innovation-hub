import { motion } from "framer-motion";
import { Link } from "wouter";

const EXPECTATIONS = [
  "Direct access to Audi business units",
  "Pilot project opportunities",
  "Collaboration with technical experts and decision-makers",
  "Real-world validation environments",
  "Potential long-term partnerships and supplier integration",
  "Exposure within a global premium automotive ecosystem",
];

const PROCESS = [
  {
    title: "Submit Your Startup",
    body: "Tell us about your company, technology, and the problem you solve.",
  },
  {
    title: "Initial Evaluation",
    body: "Our innovation and business teams review your application and assess strategic fit and potential use cases.",
  },
  {
    title: "Expert Matching",
    body: "Selected startups are connected with relevant Audi departments and technical stakeholders.",
  },
  {
    title: "Pilot & Validation",
    body: "Together, we explore pilot opportunities and evaluate real-world implementation potential.",
  },
  {
    title: "Long-Term Collaboration",
    body: "Successful pilots can evolve into strategic partnerships, procurement opportunities, or long-term collaboration.",
  },
];

const APPLICATION_ITEMS = [
  "Company overview",
  "Pitch deck",
  "Product or technology description",
  "Team information",
  "Current stage and traction",
  "Relevant customers or pilot projects",
  "Website and contact details",
];

const MAILTO = "mailto:startup@audi.de?subject=Startup%20Application%20%E2%80%94%20Audi%20Innovation%20Hub&body=Please%20attach%20or%20include%3A%0A%0A-%20Company%20overview%0A-%20Pitch%20deck%0A-%20Product%20or%20technology%20description%0A-%20Team%20information%0A-%20Current%20stage%20and%20traction%0A-%20Relevant%20customers%20or%20pilot%20projects%0A-%20Website%20and%20contact%20details%0A";

const VP = { once: true, amount: 0.1 } as const;

function up(delay = 0) {
  return {
    initial: { opacity: 0, y: 22 },
    whileInView: { opacity: 1, y: 0 },
    viewport: VP,
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as number[] },
  };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] tracking-[0.28em] font-semibold uppercase mb-5"
      style={{ color: "#BB0A21" }}>
      {children}
    </p>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-1">
      <path d="M2 7.5L5.5 11L12 3.5" stroke="#BB0A21" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Benefits() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0A0A14 0%, #0D0B1C 40%, #0A0A14 100%)" }}
    >
      <div className="w-full h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(187,10,33,0.4), transparent)" }} />

      <div className="max-w-6xl mx-auto px-8 py-28">

        {/* ── 1. What You Can Expect ─────────────────────────────── */}
        <div className="mb-32">
          <motion.div {...up(0)}>
            <SectionLabel>For Startups</SectionLabel>
          </motion.div>

          <motion.h2 {...up(0.08)}
            className="text-4xl md:text-5xl font-light text-white leading-tight tracking-tight mb-14"
          >
            What you can <span className="font-semibold">expect.</span>
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {EXPECTATIONS.map((item, i) => (
              <motion.div key={item} {...up(0.1 + i * 0.07)}
                className="flex items-start gap-4 py-3 border-b border-white/5"
              >
                <CheckIcon />
                <p className="text-white/75 text-base leading-relaxed">{item}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── 2. Application Process ─────────────────────────────── */}
        <div className="mb-32">
          <motion.div {...up(0)}>
            <SectionLabel>How It Works</SectionLabel>
          </motion.div>

          <motion.h2 {...up(0.08)}
            className="text-4xl md:text-5xl font-light text-white leading-tight tracking-tight mb-14"
          >
            Application <span className="font-semibold">process.</span>
          </motion.h2>

          <div className="relative">
            <div
              className="absolute left-[19px] top-2 bottom-2 w-px hidden md:block"
              style={{ background: "linear-gradient(to bottom, rgba(187,10,33,0.4), rgba(255,255,255,0.05))" }}
            />
            <div className="space-y-2">
              {PROCESS.map((step, i) => (
                <motion.div key={step.title} {...up(0.1 + i * 0.1)}
                  className="relative flex items-start gap-6 p-6 rounded-sm transition-colors hover:bg-white/[0.02]"
                >
                  <div
                    className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                    style={{ background: "#0D0B1C", border: "1.5px solid #BB0A21" }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="text-white font-semibold text-lg mb-2">{step.title}</h3>
                    <p className="text-white/55 text-sm leading-relaxed max-w-2xl">{step.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 3. Submit Your Application ─────────────────────────── */}
        <motion.div {...up(0)}
          className="relative overflow-hidden p-12 md:p-16 rounded-sm"
          style={{
            background: "linear-gradient(135deg, #131124 0%, #0E0C1B 100%)",
            border: "1px solid rgba(187,10,33,0.18)",
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 opacity-40 pointer-events-none"
            style={{ background: "radial-gradient(circle at top right, rgba(187,10,33,0.3), transparent 70%)" }} />

          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              <motion.div {...up(0.06)}>
                <SectionLabel>Ready to Apply</SectionLabel>
              </motion.div>

              <motion.h2 {...up(0.12)}
                className="text-3xl md:text-4xl font-light text-white leading-tight tracking-tight mb-6"
              >
                Submit your <span className="font-semibold">application.</span>
              </motion.h2>

              <motion.p {...up(0.18)}
                className="text-white/50 text-base leading-relaxed mb-8"
              >
                Start your application in minutes — our AI-guided chat walks you through everything step by step.
              </motion.p>

              <motion.div {...up(0.24)}>
                <Link href="/apply">
                  <span
                    className="inline-flex items-center gap-3 px-7 py-3.5 text-sm font-semibold tracking-wide text-white transition-opacity hover:opacity-85 cursor-pointer"
                    style={{ background: "#BB0A21", borderRadius: 2 }}
                  >
                    Apply now
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              </motion.div>
            </div>

            <div>
              <motion.p {...up(0.1)}
                className="text-white/40 text-xs tracking-[0.22em] uppercase font-semibold mb-5"
              >
                Please include
              </motion.p>
              <ul className="space-y-3">
                {APPLICATION_ITEMS.map((item, i) => (
                  <motion.li key={item} {...up(0.14 + i * 0.05)}
                    className="flex items-start gap-3 text-white/75 text-sm leading-relaxed"
                  >
                    <span className="flex-shrink-0 mt-[7px] w-1 h-1 rounded-full"
                      style={{ background: "#BB0A21" }} />
                    {item}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

      </div>

      <div className="w-full h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
    </section>
  );
}
