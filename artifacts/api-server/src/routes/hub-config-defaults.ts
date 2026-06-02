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
  applicantType: "Before we dive in — who are you? Are you building a company, part of a student team, an early-stage idea, or a solo founder?",
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

export const DEFAULT_ANALYSIS_PROMPT = `You are an expert innovation analyst at Audi AG. You have just reviewed a startup application interview transcript for the Audi Innovation Hub program.

Company: {{companyName}}

Interview Transcript:
{{transcriptText}}

Your task is to analyze this startup and return a JSON response with exactly this structure:

{
  "structuredData": {
    "companyName": "...",
    "problemStatement": "...",
    "solution": "...",
    "technology": "...",
    "stage": "...",
    "teamSize": "...",
    "traction": "...",
    "targetCollaboration": "...",
    "pitchDeckUrl": "...",
    "website": "...",
    "applicantType": "<startup | student_team | university_research | solo_inventor>"
  },
  "departmentScores": [
    {{departmentsList}}
  ],
  "businessCases": [
    {
      "departmentId": "<id of top 2 departments by score>",
      "departmentName": "<name>",
      "brief": "<200-word business case brief explaining why this startup would be valuable for this Audi department, what the collaboration could look like, and what business outcomes are possible>"
    }
  ]
}

Scoring guidelines:
- Score 0-100 on how relevant this startup is for each department
- Consider technology fit, use cases, and potential for pilot projects
- Only include business cases for the top 2 scoring departments

applicantType classification:
- "startup": A company with a product/service, aiming for commercial collaboration or pilot projects
- "student_team": University students or recent graduates working on a project, thesis, or early idea
- "university_research": Academic research group or lab seeking industry partnerships
- "solo_inventor": Individual inventor or freelancer without a team structure

Return ONLY the JSON object, no markdown, no explanation.`;
