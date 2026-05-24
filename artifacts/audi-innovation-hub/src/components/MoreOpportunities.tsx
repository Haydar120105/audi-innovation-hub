import { motion } from "framer-motion";

// ── Design tokens ─────────────────────────────────────────────────────────────
const AUDI_RED = "#BB0A21";
const VP = { once: true, amount: 0.1 } as const;

function fadeUp(delay = 0, duration = 0.65) {
  return {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: VP,
    transition: {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  };
}

// ── Problem Solving Challenges ────────────────────────────────────────────────

const CHALLENGES = [
  {
    quarter: "Q3 · 2026",
    title: "Predictive Maintenance at Scale",
    body: "Audi is looking for startups that can detect component wear patterns across a global vehicle fleet — before failures occur.",
    tag: "Manufacturing",
  },
  {
    quarter: "Q4 · 2026",
    title: "In-Car Personalisation Beyond Profiles",
    body: "How can a vehicle adapt to driver preferences in real time without relying on pre-set profiles or cloud connectivity?",
    tag: "Software & UX",
  },
  {
    quarter: "Q1 · 2027",
    title: "Circular Supply Chain Intelligence",
    body: "We want to track component reuse, recycling rates, and supplier sustainability data in a single, auditable data layer.",
    tag: "Sustainability",
  },
];

// ── Upcoming Events ────────────────────────────────────────────────────────────

const EVENTS = [
  {
    date: "12 – 13 Jun 2026",
    name: "IPAI+ Summit",
    location: "Ingolstadt",
    description:
      "Europe's flagship AI-in-industry conference, co-hosted by Audi. Startups pitch live to OEM innovation leads and tier-1 suppliers.",
    tags: ["AI", "Mobility", "Deep Tech"],
    href: "https://ipai.de",
    highlight: true,
  },
  {
    date: "24 Sep 2026",
    name: "Campus Founder Slush",
    location: "Munich",
    description:
      "Germany's most startup-dense side event to Oktoberfest week. 600+ founders, 120+ investors — networking, pitching, and rapid matchmaking.",
    tags: ["Networking", "Funding", "Early Stage"],
    href: "https://slush.org",
    highlight: false,
  },
  {
    date: "8 – 9 Oct 2026",
    name: "Audi Innovation Day",
    location: "Neckarsulm",
    description:
      "Our annual open-door event at the Neckarsulm plant. Shortlisted startups present to C-suite and department heads in 15-minute slot formats.",
    tags: ["Pitch", "Partnership", "Exclusive"],
    href: "#",
    highlight: false,
  },
  {
    date: "Nov 2026",
    name: "Startup Germany Summit",
    location: "Berlin",
    description:
      "The national gathering of Germany's startup ecosystem. Audi Innovation Hub will run a dedicated automotive & mobility track.",
    tags: ["Policy", "Ecosystem", "Mobility"],
    href: "#",
    highlight: false,
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs tracking-[0.25em] font-semibold uppercase mb-4"
      style={{ color: AUDI_RED }}
    >
      {children}
    </p>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span
      className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-sm"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.45)",
      }}
    >
      {label}
    </span>
  );
}

function ChallengeCard({
  quarter,
  title,
  body,
  tag,
  delay,
}: {
  quarter: string;
  title: string;
  body: string;
  tag: string;
  delay: number;
}) {
  return (
    <motion.div
      {...fadeUp(delay)}
      className="flex flex-col p-6 rounded-sm h-full"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[11px] font-semibold tracking-widest uppercase"
          style={{ color: AUDI_RED }}
        >
          {quarter}
        </span>
        <Tag label={tag} />
      </div>
      <h3 className="text-white font-semibold text-base leading-snug mb-3">{title}</h3>
      <p className="text-white/45 text-sm leading-relaxed flex-1">{body}</p>
      <div className="mt-5 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <a
          href="#"
          className="text-xs font-semibold flex items-center gap-1.5 transition-opacity duration-150 hover:opacity-75"
          style={{ color: AUDI_RED }}
          onClick={(e) => e.preventDefault()}
        >
          Register interest
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </motion.div>
  );
}

function EventCard({
  event,
  delay,
}: {
  event: (typeof EVENTS)[0];
  delay: number;
}) {
  return (
    <motion.a
      {...fadeUp(delay)}
      href={event.href}
      target={event.href !== "#" ? "_blank" : undefined}
      rel="noreferrer"
      className="group flex flex-col p-6 rounded-sm transition-colors"
      style={{
        background: event.highlight
          ? `linear-gradient(135deg, rgba(187,10,33,0.10) 0%, rgba(255,255,255,0.03) 100%)`
          : "rgba(255,255,255,0.03)",
        border: event.highlight
          ? `1px solid rgba(187,10,33,0.25)`
          : "1px solid rgba(255,255,255,0.07)",
        textDecoration: "none",
      }}
    >
      {/* Date + location */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p
            className="text-[11px] font-semibold tracking-widest uppercase mb-0.5"
            style={{ color: event.highlight ? AUDI_RED : "rgba(255,255,255,0.35)" }}
          >
            {event.date}
          </p>
          <p className="text-white/30 text-xs">{event.location}</p>
        </div>
        {event.highlight && (
          <span
            className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-sm flex-shrink-0"
            style={{ background: `${AUDI_RED}22`, color: AUDI_RED, border: `1px solid ${AUDI_RED}44` }}
          >
            Featured
          </span>
        )}
      </div>

      {/* Name */}
      <h3 className="text-white font-semibold text-base leading-snug mb-2 group-hover:text-white/80 transition-colors">
        {event.name}
      </h3>

      {/* Description */}
      <p className="text-white/40 text-sm leading-relaxed flex-1 mb-4">{event.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {event.tags.map((t) => (
          <Tag key={t} label={t} />
        ))}
      </div>
    </motion.a>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function MoreOpportunities() {
  return (
    <section
      className="w-full px-6 py-24"
      style={{ background: "#080812" }}
    >
      <div className="max-w-6xl mx-auto">

        {/* ── Intro ── */}
        <motion.div {...fadeUp(0)} className="mb-20 max-w-2xl">
          <SectionLabel>More Ways to Engage</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-light text-white leading-tight mb-4">
            Didn't find the right fit?{" "}
            <span className="font-semibold">There's more.</span>
          </h2>
          <p className="text-white/45 text-base leading-relaxed">
            Beyond our standard collaboration track, Audi runs quarterly problem-solving
            challenges and participates in Europe's leading startup events — giving you multiple
            entry points into our ecosystem.
          </p>
        </motion.div>

        {/* ── Problem Solving Challenges ── */}
        <div className="mb-20">
          <motion.div {...fadeUp(0.05)} className="mb-8 flex items-end justify-between gap-4">
            <div>
              <SectionLabel>Quarterly Challenges</SectionLabel>
              <h3 className="text-xl font-semibold text-white">
                Solve a real Audi problem. Pitch your solution.
              </h3>
              <p className="text-white/40 text-sm mt-2 max-w-xl leading-relaxed">
                Every quarter, Audi publishes a focused challenge from one of our business
                units. Startups register, build, and pitch — the best solutions move directly
                into pilot discussion with the relevant team.
              </p>
            </div>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="flex-shrink-0 hidden sm:flex items-center gap-1.5 text-xs font-semibold transition-opacity duration-150 hover:opacity-75"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              View all challenges
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CHALLENGES.map((c, i) => (
              <ChallengeCard key={c.quarter} {...c} delay={0.1 + i * 0.07} />
            ))}
          </div>

          {/* How it works */}
          <motion.div
            {...fadeUp(0.35)}
            className="mt-6 p-5 rounded-sm flex flex-wrap gap-6 items-start"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <p
              className="text-[11px] font-semibold tracking-widest uppercase self-center flex-shrink-0"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              How it works
            </p>
            {["Audi publishes problem", "Startups register & build", "Live pitch to business unit", "Best solution enters pilot"].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                {i > 0 && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 opacity-20">
                    <path d="M3 6h6M6.5 3l3 3-3 3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span className="text-white/50 text-xs">{step}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Upcoming Events ── */}
        <div>
          <motion.div {...fadeUp(0.05)} className="mb-8">
            <SectionLabel>Upcoming Events</SectionLabel>
            <h3 className="text-xl font-semibold text-white">
              Meet us in person.
            </h3>
            <p className="text-white/40 text-sm mt-2 max-w-xl leading-relaxed">
              From AI summits to founder conferences — these are the events where Audi's
              innovation team will be present, scouting and connecting with startups directly.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {EVENTS.map((event, i) => (
              <EventCard key={event.name} event={event} delay={0.1 + i * 0.07} />
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <motion.div
          {...fadeUp(0.2)}
          className="mt-16 p-8 rounded-sm text-center"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="text-white/30 text-xs tracking-widest uppercase font-semibold mb-3">
            Stay in the loop
          </p>
          <p className="text-white/65 text-base mb-6 max-w-md mx-auto leading-relaxed">
            New challenges and event registrations drop every quarter. Sign up for our
            innovation newsletter to be the first to know.
          </p>
          <a
            href="mailto:startup@audi.de?subject=Newsletter%20%E2%80%94%20Audi%20Innovation%20Hub"
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-sm transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]"
            style={{ background: AUDI_RED }}
          >
            Subscribe to updates
          </a>
        </motion.div>

      </div>
    </section>
  );
}
