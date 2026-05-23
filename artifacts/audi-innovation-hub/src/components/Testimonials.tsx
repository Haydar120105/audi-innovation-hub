import { motion } from "framer-motion";

// ── Data ──────────────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote:
      "Working with Audi's Innovation Hub gave us direct access to production environments and real technical decision-makers. We went from pilot to full deployment in under six months.",
    name: "Dr. Sarah Chen",
    role: "CTO & Co-Founder",
    company: "AutoSense AI",
    initials: "SC",
    accent: "#BB0A21",
  },
  {
    quote:
      "The collaboration framework removed all the typical corporate friction. We had a clear path from evaluation to partnership — real outcomes, not endless pilot loops.",
    name: "Marcus Weber",
    role: "CEO",
    company: "FleetAI Solutions",
    initials: "MW",
    accent: "#2E8FA0",
  },
  {
    quote:
      "Audi doesn't just write checks — they co-develop. Having their engineers work alongside ours was the difference between a good product and a great one.",
    name: "Priya Natarajan",
    role: "Founder",
    company: "ChargePath",
    initials: "PN",
    accent: "#7070C0",
  },
];

const PARTNERS: { name: string; category: string }[] = [
  { name: "Porsche Ventures",  category: "Strategic Investor" },
  { name: "CARIAD",            category: "Technology Partner" },
  { name: "Microsoft",         category: "Cloud & AI Partner" },
  { name: "Plug and Play",     category: "Innovation Network" },
  { name: "EIT InnoEnergy",    category: "Sustainability Partner" },
  { name: "Bosch Ventures",    category: "Strategic Investor" },
  { name: "SAP",               category: "Enterprise Partner" },
  { name: "Capgemini",         category: "Transformation Partner" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const VP = { once: true, amount: 0.15 } as const;

function fadeUp(delay = 0, duration = 0.65) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: VP,
    transition: { duration, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  };
}

function QuoteIcon({ color }: { color: string }) {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden>
      <path
        d="M0 20V12C0 5.373 3.582 1.49 10.746 0l1.527 2.4C8.836 3.49 7.09 5.8 6.582 9.4H11V20H0zm17 0V12c0-6.627 3.582-10.51 10.746-12L29.273 2.4C25.836 3.49 24.09 5.8 23.582 9.4H28V20H17z"
        fill={color}
        opacity={0.25}
      />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Testimonials() {
  return (
    <>
      {/* ── Testimonials ──────────────────────────────────────────────── */}
      <section
        className="relative w-full overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, #0A0A14 0%, #0C0B1E 50%, #0A0A14 100%)",
        }}
      >
        {/* top separator */}
        <div
          className="w-full h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(187,10,33,0.35), transparent)",
          }}
        />

        <div className="max-w-6xl mx-auto px-8 py-28">
          {/* Header */}
          <motion.div {...fadeUp(0)} className="mb-4">
            <p
              className="text-[11px] tracking-[0.28em] font-semibold uppercase"
              style={{ color: "#BB0A21" }}
            >
              What Startups Say
            </p>
          </motion.div>

          <motion.h2
            {...fadeUp(0.08)}
            className="text-4xl md:text-5xl font-light text-white leading-tight tracking-tight mb-16"
          >
            Trusted by <span className="font-semibold">founders.</span>
          </motion.h2>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                {...fadeUp(0.1 + i * 0.1)}
                className="relative flex flex-col p-8 rounded-sm"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {/* top accent line */}
                <div
                  className="absolute top-0 left-8 right-8 h-px"
                  style={{
                    background: `linear-gradient(90deg, ${t.accent}, transparent)`,
                  }}
                />

                <QuoteIcon color={t.accent} />

                <p className="text-white/65 text-sm leading-relaxed mt-5 flex-1">
                  {t.quote}
                </p>

                <div className="mt-8 flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                    style={{ background: t.accent }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold leading-tight">
                      {t.name}
                    </p>
                    <p className="text-white/35 text-xs mt-0.5">
                      {t.role} · {t.company}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Partners ──────────────────────────────────────────────────── */}
      <section
        className="relative w-full overflow-hidden"
        style={{ background: "#080810" }}
      >
        <div
          className="w-full h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          }}
        />

        <div className="max-w-6xl mx-auto px-8 py-24">
          {/* Header */}
          <motion.div {...fadeUp(0)} className="text-center mb-16">
            <p
              className="text-[11px] tracking-[0.28em] font-semibold uppercase mb-4"
              style={{ color: "#BB0A21" }}
            >
              Ecosystem
            </p>
            <h2 className="text-3xl md:text-4xl font-light text-white leading-tight tracking-tight">
              Built with the <span className="font-semibold">right partners.</span>
            </h2>
            <p className="text-white/35 text-sm mt-4 max-w-lg mx-auto leading-relaxed">
              We bring strategic investors, technology leaders, and innovation
              networks together around the startups we collaborate with.
            </p>
          </motion.div>

          {/* Partner grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PARTNERS.map((p, i) => (
              <motion.div
                key={p.name}
                {...fadeUp(0.05 + i * 0.05)}
                className="group flex flex-col items-center justify-center gap-2 py-7 px-4 rounded-sm transition-all duration-300"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                whileHover={{
                  background: "rgba(255,255,255,0.045)",
                  borderColor: "rgba(255,255,255,0.12)",
                }}
              >
                {/* Wordmark placeholder — replace with <img> when real logos are available */}
                <p className="text-white/70 text-sm font-semibold tracking-tight text-center group-hover:text-white transition-colors">
                  {p.name}
                </p>
                <p className="text-white/25 text-[10px] tracking-[0.12em] uppercase text-center">
                  {p.category}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Bottom note */}
          <motion.p
            {...fadeUp(0.5)}
            className="text-center text-white/20 text-xs mt-12 tracking-wide"
          >
            Partnerships are subject to individual agreements.
          </motion.p>
        </div>

        <div
          className="w-full h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
          }}
        />

        {/* Footer strip */}
        <div className="max-w-6xl mx-auto px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/20 text-xs tracking-widest uppercase">
            Audi Innovation Hub · {new Date().getFullYear()}
          </p>
          <p className="text-white/15 text-xs">
            startup@audi.de
          </p>
        </div>
      </section>
    </>
  );
}
