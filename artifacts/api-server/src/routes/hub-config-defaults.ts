// Shared defaults for hub_config — used by chat.ts, admin routes, and public config route.
// These are the "factory defaults" that apply when no DB override exists.

export const DEFAULT_FOCUS_AREAS = [
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

export const DEFAULT_FIELD_QUESTIONS: Record<string, string> = {
  companyName: "What's the name of your startup?",
  problem: "What problem are you solving, and who are your target customers?",
  solution: "How does your solution work — what do you actually build or offer?",
  technology: "What's the core technology behind it, and what makes it defensible or unique?",
  stage: "What stage is your company at right now — pre-seed, seed, Series A, or further along?",
  teamSize: "How many people are on your team, and what are the key areas of expertise?",
  targetDepartments:
    "Which Audi departments do you think you could collaborate with most effectively? We have: Production & Manufacturing, R&D, Design Studio, Logistics & Supply Chain, Sales & Customer Experience, and Digital & IT.",
};

export const DEFAULT_SYSTEM_PROMPT_INTRO =
  "You are the official AI assistant for the Audi Innovation Hub — Audi AG's startup collaboration program.";
