import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";

const FOCUS_AREAS = [
  {
    title: "AI & Intelligent Systems",
    topics: ["Generative AI", "AI Agents", "Computer Vision", "Predictive Analytics", "Enterprise AI", "Voice AI", "Knowledge Systems"],
  },
  {
    title: "Future Mobility",
    topics: ["Autonomous Driving", "Smart Mobility", "Fleet Management", "MaaS", "Urban Mobility", "Connected Vehicles"],
  },
  {
    title: "Software Defined Vehicle",
    topics: ["Vehicle OS", "Over-the-Air Updates", "Embedded Software", "Vehicle Data Platforms", "Cybersecurity", "Edge Computing"],
  },
  {
    title: "Smart Factory & Production",
    topics: ["Robotics", "Industrial AI", "Computer Vision", "Digital Twin", "Predictive Maintenance", "IoT", "Process Automation"],
  },
  {
    title: "Battery, Energy & Charging",
    topics: ["Battery Tech", "Fast Charging", "Smart Charging", "Energy Optimization", "Battery Analytics", "Recycling", "Grid Integration"],
  },
  {
    title: "Sustainability & Circular Economy",
    topics: ["Carbon Tracking", "ESG Software", "Recycling", "Circular Materials", "Sustainable Manufacturing", "Traceability"],
  },
  {
    title: "Customer Experience & Retail",
    topics: ["Digital Retail", "CRM", "Personalization", "AI Sales", "Immersive Experiences", "Omnichannel", "In-Car Experience"],
  },
  {
    title: "Design, XR & Human Interaction",
    topics: ["AR/VR", "Spatial Computing", "HMI", "UX/UI", "AI-assisted Design", "Immersive Cockpits"],
  },
  {
    title: "Data, Cloud & Cybersecurity",
    topics: ["Data Platforms", "Secure Infrastructure", "Identity", "Cloud", "Zero Trust", "Automotive Cybersecurity"],
  },
  {
    title: "Future of Work & Enterprise Productivity",
    topics: ["Employee AI", "Knowledge Management", "Internal Copilots", "Learning Platforms", "Recruiting Tech", "Collaboration Tools"],
  },
  {
    title: "Advanced Engineering & R&D",
    topics: ["Simulation", "Materials", "Sensor Fusion", "LiDAR", "Aerodynamics", "Testing Automation"],
  },
  {
    title: "Open Category / Wildcard",
    topics: ["Your breakthrough idea", "If you don't fit a category", "You belong here"],
    isWildcard: true,
  },
];

// Custom strong ease-out — starts fast, feels instantly responsive
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.42, ease: EASE_OUT },
  }),
};

interface FocusArea {
  title: string;
  topics: string[];
  isWildcard?: boolean;
}

export default function FocusAreas() {
  const [areas, setAreas] = useState<FocusArea[]>(FOCUS_AREAS);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: { focusAreas?: FocusArea[] }) => {
        if (Array.isArray(data?.focusAreas) && data.focusAreas.length > 0) {
          setAreas(data.focusAreas);
        }
      })
      .catch(() => {
        // Silent fallback to hardcoded defaults — network error or backend unavailable
      });
  }, []);

  return (
    <section className="w-full bg-[#0A0A14] border-t border-white/5 px-6 md:px-12 lg:px-20 py-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="max-w-7xl mx-auto mb-12"
      >
        <p className="text-xs font-semibold tracking-[0.2em] text-[#BB0A21] uppercase mb-3">
          Audi Startup Program
        </p>
        <h2 className="text-4xl md:text-5xl font-light text-white leading-tight">
          Fields of Interest
        </h2>
        <div className="w-10 h-[2px] bg-[#BB0A21] mt-5" />
        <p className="text-white/40 text-sm mt-5 leading-relaxed max-w-xl">
          {areas.length} areas where we actively seek startup collaboration to drive technology-led innovation across the Audi value chain.
        </p>
      </motion.div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {areas.map((area, idx) => (
          <motion.div
            key={idx}
            custom={idx}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            data-testid={`card-focus-area-${idx}`}
            className={`group relative rounded-sm border transition-[border-color,background-color] duration-200
              ${area.isWildcard
                ? "border-[#BB0A21]/30 bg-[#BB0A21]/5 hover:border-[#BB0A21]/60 hover:bg-[#BB0A21]/10"
                : "border-white/5 bg-white/[0.025] hover:border-white/12 hover:bg-white/[0.05]"
              }`}
          >
            <div className="px-5 py-5">
              <div className="flex items-start justify-between mb-4">
                <span className="text-[#BB0A21]/50 text-xs font-mono group-hover:text-[#BB0A21]/80 transition-colors">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                {area.isWildcard && (
                  <span className="text-[9px] tracking-widest text-[#BB0A21]/60 uppercase border border-[#BB0A21]/25 px-1.5 py-0.5 rounded-sm">
                    Open
                  </span>
                )}
              </div>
              <h3 className="text-white/90 text-sm font-medium mb-4 group-hover:text-white transition-colors leading-snug min-h-[2.5rem]">
                {area.title}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {area.topics.map((topic, tIdx) => (
                  <span
                    key={tIdx}
                    data-testid={`tag-topic-${idx}-${tIdx}`}
                    className={`text-[10px] px-2 py-0.5 rounded-sm transition-colors
                      ${area.isWildcard
                        ? "bg-[#BB0A21]/15 text-[#BB0A21]/80 border border-[#BB0A21]/20"
                        : "bg-white/5 text-white/40 border border-white/5 group-hover:text-white/60 group-hover:border-white/10"
                      }`}
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.45, ease: EASE_OUT }}
        className="max-w-7xl mx-auto mt-12 flex items-center gap-6"
      >
        <Link href="/apply">
          <button
            className="bg-[#BB0A21] hover:bg-[#A0081C] text-white px-10 py-4 font-medium transition-[background-color,transform] duration-150 active:scale-[0.97] flex items-center gap-2 rounded-sm text-sm tracking-wide"
            data-testid="button-apply-now"
          >
            <span>Apply Now</span>
            <span>&rarr;</span>
          </button>
        </Link>
        <p className="text-white/25 text-xs">
          Fast, unbureaucratic, and seamless collaboration.
        </p>
      </motion.div>
    </section>
  );
}
