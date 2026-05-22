import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const W = 1000;
const H = 720;
const TX = 62;
const TY = 31;
const TZ = 52;

function isoX(x: number, y: number) {
  return W / 2 + (x - y) * TX;
}
function isoY(x: number, y: number, z = 0) {
  return H / 2 + (x + y) * TY - z * TZ;
}

function getBoxFaces(x: number, y: number, z: number, w: number, d: number, h: number) {
  const pts = (coords: [number, number][]) => coords.map(p => p.join(",")).join(" ");
  const Tfl: [number, number] = [isoX(x, y), isoY(x, y, z + h)];
  const Tfr: [number, number] = [isoX(x + w, y), isoY(x + w, y, z + h)];
  const Tbr: [number, number] = [isoX(x + w, y + d), isoY(x + w, y + d, z + h)];
  const Tbl: [number, number] = [isoX(x, y + d), isoY(x, y + d, z + h)];
  const Bfl: [number, number] = [isoX(x, y), isoY(x, y, z)];
  const Bbl: [number, number] = [isoX(x, y + d), isoY(x, y + d, z)];
  const Bfr: [number, number] = [isoX(x + w, y), isoY(x + w, y, z)];
  const Bbr: [number, number] = [isoX(x + w, y + d), isoY(x + w, y + d, z)];
  return {
    top: pts([Tfl, Tfr, Tbr, Tbl]),
    left: pts([Tfl, Tbl, Bbl, Bfl]),
    right: pts([Tfr, Tbr, Bbr, Bfr]),
  };
}

// Returns the full visible silhouette of a box (for hit detection)
function hitZone(x: number, y: number, h: number, w: number, d: number): string {
  return [
    [isoX(x, y), isoY(x, y, h)],
    [isoX(x + w, y), isoY(x + w, y, h)],
    [isoX(x + w, y + d), isoY(x + w, y + d, h)],
    [isoX(x + w, y + d), isoY(x + w, y + d, 0)],
    [isoX(x, y + d), isoY(x, y + d, 0)],
    [isoX(x, y), isoY(x, y, 0)],
  ].map(p => p.join(",")).join(" ");
}

interface BoxProps {
  x: number; y: number; z?: number;
  w: number; d: number; h: number;
  tc: string; lc: string; rc: string;
  delay?: number;
}
function Box({ x, y, z = 0, w, d, h, tc, lc, rc, delay = 0 }: BoxProps) {
  const f = getBoxFaces(x, y, z, w, d, h);
  const ox = isoX(x + w / 2, y + d / 2);
  const oy = isoY(x + w / 2, y + d / 2, z);
  return (
    <motion.g
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformOrigin: `${ox}px ${oy}px` }}
    >
      <polygon points={f.right} fill={rc} />
      <polygon points={f.left} fill={lc} />
      <polygon points={f.top} fill={tc} />
    </motion.g>
  );
}

function Windows({ x, y, z, w, d, h, side }: { x: number; y: number; z: number; w: number; d: number; h: number; side: "left" | "right" }) {
  const els: JSX.Element[] = [];
  const rows = Math.floor(h / 1.1);
  const cols = side === "right" ? Math.floor(w / 1.0) : Math.floor(d / 1.0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wz = z + 0.35 + r * 0.9;
      if (wz + 0.45 > z + h) continue;
      let wx = x, wy = y;
      if (side === "right") { wx = x + 0.3 + c * 0.85; if (wx + 0.35 > x + w) continue; }
      else { wy = y + 0.3 + c * 0.85; if (wy + 0.35 > y + d) continue; }
      const p1: [number, number] = [isoX(wx, wy), isoY(wx, wy, wz)];
      const p2: [number, number] = side === "right"
        ? [isoX(wx + 0.35, wy), isoY(wx + 0.35, wy, wz)]
        : [isoX(wx, wy + 0.35), isoY(wx, wy + 0.35, wz)];
      const p3: [number, number] = side === "right"
        ? [isoX(wx + 0.35, wy), isoY(wx + 0.35, wy, wz + 0.45)]
        : [isoX(wx, wy + 0.35), isoY(wx, wy + 0.35, wz + 0.45)];
      const p4: [number, number] = [isoX(wx, wy), isoY(wx, wy, wz + 0.45)];
      const lit = (r + c) % 3 !== 0;
      els.push(
        <polygon key={`${r}-${c}`}
          points={[p1, p2, p3, p4].map(p => p.join(",")).join(" ")}
          fill={lit ? "rgba(180,210,255,0.45)" : "rgba(30,30,60,0.6)"}
        />
      );
    }
  }
  return <>{els}</>;
}

// R8-inspired Audi — side-elevation profile, illustrative 3D style
function SpokeWheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#0C0C14" />
      <circle cx={cx} cy={cy} r={r * 0.78} fill="#191920" />
      {[0, 72, 144, 216, 288].map((deg, j) => {
        const rad = (deg - 18) * Math.PI / 180;
        return (
          <line key={j}
            x1={cx + Math.cos(rad) * r * 0.18}
            y1={cy + Math.sin(rad) * r * 0.18}
            x2={cx + Math.cos(rad) * r * 0.72}
            y2={cy + Math.sin(rad) * r * 0.72}
            stroke="#7A7A90" strokeWidth={r * 0.22} strokeLinecap="round"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.22} fill="#505060" />
      <circle cx={cx} cy={cy} r={r * 0.12} fill="#909098" />
    </g>
  );
}

function AudiCar({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g transform={`translate(${cx},${cy}) scale(0.55)`} opacity={0.78}>
      {/* Ground shadow */}
      <ellipse rx={24} ry={6} cy={11} fill="rgba(0,0,0,0.5)" />

      {/* ── Lower body / rocker panel ── */}
      <path
        d="M -21,3 C -21,3 -19,-1 -15,-3 C -11,-5 -5,-6.5 2,-7 C 8,-7.5 14,-6 18,-4 C 21,-2 22,1 21,5 C 20,7 17,8 12,8 C 4,8 -12,8 -17,8 C -20,8 -21,6 -21,3 Z"
        fill={color}
        style={{ filter: "brightness(0.82)" }}
      />

      {/* ── Top body highlight (light hits the hood & door) ── */}
      <path
        d="M -9,-2 C -4,-5.5 3,-7 9,-6.5 C 14,-6 18,-4 19,-2 C 15,-1 9,0 2,0.5 C -4,1 -9,0.5 -9,-2 Z"
        fill={color}
        style={{ filter: "brightness(1.25)" }}
        opacity={0.9}
      />

      {/* ── Cabin / roof ── */}
      <path
        d="M -10,-5 C -8,-10 -3,-13 2,-13.5 C 7,-14 11,-12 13,-9 C 14,-7 12,-5.5 9,-5.5 C 4,-5.5 -7,-5.5 -10,-5.5 Z"
        fill={color}
        style={{ filter: "brightness(1.18)" }}
      />

      {/* Windshield */}
      <path d="M -7,-6 C -5,-10 -1,-13 3,-13 C 7,-13 10,-10 10,-7 L 8,-5.5 Z"
        fill="rgba(160,210,255,0.22)" />
      {/* Rear window */}
      <path d="M -10,-5.5 C -9,-9 -7,-11 -5,-12 L -7,-5.5 Z"
        fill="rgba(160,210,255,0.12)" />

      {/* A-pillar line */}
      <line x1={-7} y1={-5.5} x2={-4} y2={-12}
        stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />

      {/* ── R8 side blade air intake ── */}
      <path d="M 10,-3.5 L 15,-3.5 L 16,-1.5 L 11,-1 Z"
        fill="rgba(0,0,0,0.38)" />
      <path d="M 10.5,-3.5 L 14.5,-3.5 L 14.5,-2.8 L 10.5,-2.8 Z"
        fill="rgba(0,0,0,0.2)" />

      {/* ── Rear spoiler ── */}
      <rect x={18.5} y={-2.5} width={4} height={2} rx={1}
        fill={color} style={{ filter: "brightness(1.12)" }} />
      <rect x={19} y={-4.5} width={3} height={2.2} rx={0.7}
        fill={color} style={{ filter: "brightness(1.08)" }} />

      {/* ── Wheels ── 2 large R8 spoked rims, side profile ── */}
      <SpokeWheel cx={-13} cy={8} r={8} />
      <SpokeWheel cx={11} cy={8} r={8} />

      {/* Wheel arch cutouts on body */}
      <circle cx={-13} cy={8} r={9.5} fill="none" stroke={color}
        strokeWidth="1.5" style={{ filter: "brightness(0.5)" }}
        clipPath="url(#bodyClip)" opacity={0.6} />
      <circle cx={11} cy={8} r={9.5} fill="none" stroke={color}
        strokeWidth="1.5" style={{ filter: "brightness(0.5)" }}
        clipPath="url(#bodyClip)" opacity={0.6} />

      {/* ── Headlights — R8 blade DRL style ── */}
      <path d="M 20,1 L 23,0 L 23,3 L 20,3 Z" fill="rgba(255,248,200,0.95)" />
      <path d="M 20,-1.5 L 22,-2 L 22,0 L 20,0 Z" fill="rgba(255,248,200,0.55)" />
      {/* Headlight inner glow */}
      <ellipse cx={21.5} cy={1.5} rx={1.2} ry={0.8} fill="rgba(255,255,240,0.5)" />

      {/* ── Tail lights ── */}
      <path d="M -20,1.5 L -23,1 L -23,4 L -20,4 Z" fill="rgba(255,35,35,0.95)" />
      <path d="M -20,-0.5 L -22,-1 L -22,1 L -20,1 Z" fill="rgba(255,35,35,0.45)" />

      {/* ── Audi four rings ── */}
      {[1.5, 4.5, 7.5, 10.5].map((rx, i) => (
        <circle key={i} cx={rx} cy={-3}
          r={1.8} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
      ))}
    </g>
  );
}

function MovingCar({ path, duration, delay, color }: { path: [number, number][]; duration: number; delay: number; color: string }) {
  const [pos, setPos] = useState({ x: isoX(path[0][0], path[0][1]), y: isoY(path[0][0], path[0][1], 0.05) });
  const totalLen = path.length - 1;
  useEffect(() => {
    let start: number | null = null;
    let frame: number;
    const tick = (ts: number) => {
      if (start === null) start = ts - delay * 1000;
      const t = (((ts - start) / 1000 % duration) + duration) % duration / duration;
      const segT = t * totalLen;
      const seg = Math.min(Math.floor(segT), totalLen - 1);
      const frac = segT - seg;
      const a = path[seg], b = path[Math.min(seg + 1, totalLen)];
      setPos({ x: isoX(a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac), y: isoY(a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac, 0.05) });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <AudiCar cx={pos.x} cy={pos.y} color={color} />;
}

function Person({ x, y, duration, delay }: { x: number; y: number; duration: number; delay: number }) {
  const sx = isoX(x, y), sy = isoY(x, y, 0);
  const ex = isoX(x + 2, y), ey = isoY(x + 2, y, 0);
  return (
    <motion.g animate={{ x: [0, ex - sx, 0], y: [0, ey - sy, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "linear" }}>
      <circle cx={sx} cy={sy - 10} r={3.5} fill="#E8E8F0" />
      <rect x={sx - 2} y={sy - 7} width={4} height={6} rx={1} fill="#C8C8D8" />
      <line x1={sx - 3} y1={sy - 5} x2={sx + 3} y2={sy - 5} stroke="#C8C8D8" strokeWidth="1.5" />
    </motion.g>
  );
}

function Smoke({ x, y, z }: { x: number; y: number; z: number }) {
  const sx = isoX(x, y), sy = isoY(x, y, z);
  return (
    <>
      {[0, 1, 2].map(i => (
        <motion.g key={i}
          initial={{ y: 0, opacity: 0.2, scale: 1 }}
          animate={{ y: -(25 + i * 12), opacity: 0, scale: 2 + i * 0.6 }}
          transition={{ duration: 2.5 + i * 0.8, delay: i * 0.9, repeat: Infinity, ease: "easeOut" }}
          style={{ originX: sx, originY: sy }}>
          <circle cx={sx} cy={sy} r={6 + i * 2} fill="rgba(200,200,230,0.1)" />
        </motion.g>
      ))}
    </>
  );
}

function Tree({ x, y }: { x: number; y: number }) {
  const tx = isoX(x, y), ty = isoY(x, y, 0);
  return (
    <g>
      <line x1={tx} y1={ty} x2={tx} y2={ty - 20} stroke="#1A2E1A" strokeWidth="2.5" />
      <circle cx={tx} cy={ty - 26} r={10} fill="#163020" opacity={0.9} />
      <circle cx={tx - 4} cy={ty - 22} r={7} fill="#1A3A24" opacity={0.8} />
      <circle cx={tx + 3} cy={ty - 30} r={6} fill="#204028" opacity={0.75} />
    </g>
  );
}

// ── Department data ──────────────────────────────────────────────
interface Department {
  id: string;
  label: string;
  color: string;
  // Popup anchor in iso coords (top of tallest building)
  anchorX: number; anchorY: number; anchorZ: number;
  // Hit zone: encloses the full building group
  hitX: number; hitY: number; hitW: number; hitD: number; hitH: number;
  description: string;
  focus: string[];
}

const DEPARTMENTS: Department[] = [
  {
    id: "production",
    label: "Production",
    color: "#7070C0",
    anchorX: -0.8, anchorY: 1.2, anchorZ: 2.2,
    hitX: -2.0, hitY: 0.2, hitW: 3.2, hitD: 2.4, hitH: 2.2,
    description: "The beating heart of Audi manufacturing. We run some of the world's most advanced assembly lines and are looking for startups that push the boundaries of what's possible on the factory floor.",
    focus: ["Smart Factory", "Robotics", "Industrial AI", "Digital Twin", "Predictive Maintenance", "Process Automation"],
  },
  {
    id: "rnd",
    label: "R&D",
    color: "#CC3366",
    anchorX: 1.02, anchorY: 0.55, anchorZ: 4.6,
    hitX: 0.3, hitY: 0.15, hitW: 1.5, hitD: 1.0, hitH: 4.5,
    description: "Where next-generation vehicles are born. Our engineers are pushing the frontier of automotive technology — and we're looking for deep-tech startups to join the mission.",
    focus: ["Simulation", "Sensor Fusion", "LiDAR", "Materials Science", "Testing Automation", "Aerodynamics"],
  },
  {
    id: "design",
    label: "Design Studio",
    color: "#2E8FA0",
    anchorX: 2.9, anchorY: 0.6, anchorZ: 2.6,
    hitX: 2.1, hitY: 0.15, hitW: 2.0, hitD: 1.2, hitH: 2.5,
    description: "Crafting the future of automotive aesthetics and human-machine interaction. Audi design sets global standards — startups who can extend this vision with new tools are welcome.",
    focus: ["AR/VR", "Spatial Computing", "HMI", "AI-assisted Design", "UX/UI", "Immersive Cockpits"],
  },
  {
    id: "logistics",
    label: "Logistics",
    color: "#3A5080",
    anchorX: -0.2, anchorY: 3.4, anchorZ: 1.5,
    hitX: -2.0, hitY: 3.0, hitW: 4.0, hitD: 1.2, hitH: 1.5,
    description: "Supply chain excellence at global scale. Our logistics network spans continents — and we're seeking startups that can make it smarter, faster, and more resilient.",
    focus: ["Fleet Management", "Digital Twin", "Predictive Logistics", "IoT", "Warehouse AI", "Traceability"],
  },
  {
    id: "sales",
    label: "Sales",
    color: "#802050",
    anchorX: 2.55, anchorY: 2.5, anchorZ: 2.4,
    hitX: 1.9, hitY: 2.0, hitW: 1.5, hitD: 1.2, hitH: 2.4,
    description: "Reimagining how customers discover, configure, and buy their Audi. From digital showrooms to AI-powered personalization, we're investing in the future of premium retail.",
    focus: ["Digital Retail", "CRM", "Personalization", "AI Sales", "Omnichannel", "In-Car Experience"],
  },
  {
    id: "digital",
    label: "Digital & IT",
    color: "#1A5090",
    anchorX: 4.85, anchorY: 2.0, anchorZ: 3.4,
    hitX: 4.3, hitY: 1.5, hitW: 1.2, hitD: 1.0, hitH: 3.4,
    description: "The digital backbone of Audi's connected enterprise. We're building the infrastructure, platforms, and security systems that power a software-defined car company.",
    focus: ["Cloud Platforms", "Cybersecurity", "Zero Trust", "Enterprise AI", "Data Infrastructure", "Internal Copilots"],
  },
];

// ── Floating popup card — rendered inside SVG as foreignObject ──
// cardX/cardY are SVG viewBox coordinates supplied by the parent
function DeptCard({ dept, cardX, cardY, cardW, onClose, onApply }: {
  dept: Department; cardX: number; cardY: number; cardW: number; onClose: () => void; onApply: () => void;
}) {
  return (
    <foreignObject
      x={cardX} y={cardY}
      width={cardW} height={290}
      style={{ overflow: "visible" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 6 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        data-testid={`dept-card-${dept.id}`}
        style={{ width: cardW, fontFamily: "'Inter', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(14,13,30,0.97)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 18px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8,
          }}>
            <div>
              <p style={{ color: dept.color, fontSize: 9, letterSpacing: "0.18em", fontWeight: 700,
                textTransform: "uppercase", marginBottom: 3 }}>Department</p>
              <h3 style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.2 }}>
                {dept.label}
              </h3>
            </div>
            <button
              data-testid={`close-dept-card-${dept.id}`}
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none",
                cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0, marginTop: 1 }}
            >×</button>
          </div>

          {/* Body */}
          <div style={{ padding: "12px 18px 14px" }}>
            <p style={{ color: "rgba(255,255,255,0.58)", fontSize: 11, lineHeight: 1.65,
              margin: "0 0 10px" }}>{dept.description}</p>

            {/* Focus chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
              {dept.focus.map((f, i) => (
                <span key={i} style={{
                  fontSize: 9, padding: "2px 7px", borderRadius: 3,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.45)",
                }}>{f}</span>
              ))}
            </div>

            {/* CTA */}
            <button
              data-testid={`apply-dept-${dept.id}`}
              onClick={(e) => { e.stopPropagation(); onApply(); }}
              style={{
                display: "block", width: "100%", textAlign: "center", padding: "9px 0",
                borderRadius: 3, fontSize: 11, fontWeight: 700,
                letterSpacing: "0.08em", color: "#fff", background: dept.color,
                border: "none", cursor: "pointer",
              }}
            >Apply to {dept.label} →</button>
          </div>
        </div>
      </motion.div>
    </foreignObject>
  );
}

// ── Main scene ───────────────────────────────────────────────────
export default function PlantScene() {
  const [activeDept, setActiveDept] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const selected = DEPARTMENTS.find(d => d.id === activeDept) ?? null;

  // All paths are closed loops — last point == first point
  const loopRed: [number, number][]   = [[-2,0],[0,0],[2,0],[4,0],[5,0],[5,1.5],[5,3],[4,3],[2,3],[0,3],[-2,3],[-2,1.5],[-2,0]];
  const loopBlue: [number, number][]  = [[5,3],[5,1.5],[5,0],[4,0],[2,0],[0,0],[-2,0],[-2,1.5],[-2,3],[0,3],[2,3],[4,3],[5,3]];
  // Inner figure-8: down x=1, cross bottom, up x=3, cross top, back to start
  const loopBlack: [number, number][] = [[1,-1],[1,0],[1,1.5],[1,3],[1,4],[2,4],[3,4],[3,3],[3,1.5],[3,0],[3,-1],[2,-1],[1,-1]];

  return (
    <div className="relative w-full h-full overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 45% 45%, #1A0D30 0%, #0C0A1E 50%, #0A0808 100%)" }}
      onClick={() => setActiveDept(null)}
    >
      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
        backgroundSize: "48px 48px"
      }} />

      {/* Audi logo */}
      <div className="absolute top-7 left-7 z-20">
        <motion.img
          src="/audi-logo.png"
          alt="Audi"
          width={110}
          style={{ opacity: 0.92 }}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 0.92, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>

      {/* Hero headline */}
      <div className="absolute top-8 left-0 right-0 text-center pointer-events-none z-10 px-8">
        <motion.p
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.9 }}
          className="text-sm tracking-[0.28em] uppercase font-semibold mb-3"
          style={{ color: "#BB0A21" }}
        >
          Audi Innovation Hub
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-white text-4xl md:text-5xl lg:text-7xl font-light leading-[1.1] tracking-tight"
        >
          The <span className="italic font-light">future</span> is <span className="font-semibold">built together.</span>
        </motion.h1>
      </div>

      {/* Hint */}
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 0.35 }}
        transition={{ delay: 2.5, duration: 1 }}
        className="absolute bottom-20 left-0 right-0 text-center text-white text-[10px] tracking-widest uppercase pointer-events-none z-10"
      >
        Click a building to explore
      </motion.p>

      {/* SVG scene */}
      <svg width="100%" height="100%" viewBox={`0 -55 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="bldShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="3" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.6" />
          </filter>
          <radialGradient id="glowRed" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#BB0A21" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#BB0A21" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glowBlue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0A4ABB" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0A4ABB" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#121128" />
            <stop offset="100%" stopColor="#0C0B1A" />
          </linearGradient>
        </defs>

        {/* Ground */}
        <polygon fill="url(#ground)" points={[
          [isoX(-3, -1.5), isoY(-3, -1.5)],
          [isoX(7, -1.5), isoY(7, -1.5)],
          [isoX(7, 5.5), isoY(7, 5.5)],
          [isoX(-3, 5.5), isoY(-3, 5.5)],
        ].map(p => p.join(",")).join(" ")} />

        {/* Roads */}
        {([
          [[-2.2, -0.15], [5.2, -0.15], [5.2, 0.15], [-2.2, 0.15]],
          [[-2.2, 2.85], [5.2, 2.85], [5.2, 3.15], [-2.2, 3.15]],
          [[-2.15, 0], [-1.85, 0], [-1.85, 3], [-2.15, 3]],
          [[4.85, 0], [5.15, 0], [5.15, 3], [4.85, 3]],
        ] as [number, number][][]).map((pts, i) => (
          <polygon key={i} fill="#1A1832"
            points={pts.map(([px, py]) => `${isoX(px, py)},${isoY(px, py, 0.02)}`).join(" ")} />
        ))}
        {([
          [[0.85, -1], [1.15, -1], [1.15, 4], [0.85, 4]],
          [[2.85, -1], [3.15, -1], [3.15, 4], [2.85, 4]],
        ] as [number, number][][]).map((pts, i) => (
          <polygon key={i} fill="#161528"
            points={pts.map(([px, py]) => `${isoX(px, py)},${isoY(px, py, 0.02)}`).join(" ")} />
        ))}

        {/* Cars — rendered before buildings so buildings occlude them */}
        <MovingCar path={loopRed}   duration={18} delay={0}  color="#7A1018" />
        <MovingCar path={loopBlue}  duration={22} delay={6}  color="#0E2E58" />
        <MovingCar path={loopBlack} duration={14} delay={2}  color="#1A1828" />

        {/* BUILDINGS — wider footprints, ~35% shorter than before */}
        {/* 1 Production */}
        <g filter="url(#bldShadow)">
          <Box x={-2.0} y={0.2} w={3.2} d={2.4} h={1.1} tc="#3A3860" lc="#12112A" rc="#252345" delay={0.1} />
          <Box x={-1.6} y={0.4} w={2.4} d={2.0} h={1.7} tc="#46446E" lc="#18172E" rc="#302E50" delay={0.18} />
          <Box x={-1.2} y={0.6} w={1.5} d={1.6} h={2.0} tc="#52508A" lc="#1C1A38" rc="#3A3870" delay={0.26} />
          <Box x={-1.1} y={0.85} w={0.22} d={0.22} h={3.1} tc="#5A5878" lc="#1A1830" rc="#3C3A5C" delay={0.35} />
        </g>
        {/* 2 R&D — still tallest but reduced */}
        <g filter="url(#bldShadow)">
          <Box x={0.3} y={0.15} w={1.5} d={1.0} h={2.2} tc="#5A1A38" lc="#20080E" rc="#3E1028" delay={0.14} />
          <Box x={0.45} y={0.22} w={1.2} d={0.85} h={3.6} tc="#7A2448" lc="#2A0C18" rc="#521838" delay={0.22} />
          <Box x={0.6} y={0.30} w={0.85} d={0.65} h={4.3} tc="#8A2A50" lc="#300E1C" rc="#5E1C40" delay={0.30} />
          <line x1={isoX(1.02, 0.62)} y1={isoY(1.02, 0.62, 4.3)}
            x2={isoX(1.02, 0.62)} y2={isoY(1.02, 0.62, 4.3) - 20}
            stroke="#BB0A21" strokeWidth="2" opacity={0.85} />
          <circle cx={isoX(1.02, 0.62)} cy={isoY(1.02, 0.62, 4.3) - 20} r={3}
            fill="#BB0A21" opacity={0.9} />
        </g>
        {/* 3 Design */}
        <g filter="url(#bldShadow)">
          <Box x={2.1} y={0.15} w={2.0} d={1.2} h={1.0} tc="#1A3A50" lc="#081422" rc="#102A3A" delay={0.2} />
          <Box x={2.3} y={0.25} w={1.6} d={1.0} h={1.8} tc="#245070" lc="#0C1C2C" rc="#163850" delay={0.28} />
          <Box x={2.55} y={0.35} w={1.1} d={0.8} h={2.4} tc="#2C6080" lc="#0E2030" rc="#1C4860" delay={0.36} />
        </g>
        {/* 4 Logistics */}
        <g filter="url(#bldShadow)">
          <Box x={-2.0} y={3.0} w={4.0} d={1.2} h={0.8} tc="#202840" lc="#0A1018" rc="#161E2E" delay={0.24} />
          <Box x={-1.7} y={3.05} w={3.4} d={1.1} h={1.3} tc="#2A3450" lc="#101826" rc="#1E2840" delay={0.32} />
          <Box x={-0.6} y={4.0} w={1.2} d={0.6} h={0.6} tc="#1E2A3C" lc="#0C1420" rc="#14202E" delay={0.40} />
        </g>
        {/* 5 Sales */}
        <g filter="url(#bldShadow)">
          <Box x={1.9} y={2.0} w={1.5} d={1.2} h={1.4} tc="#4A1A30" lc="#1A0812" rc="#301020" delay={0.28} />
          <Box x={2.05} y={2.1} w={1.2} d={1.0} h={2.2} tc="#601E3C" lc="#200A16" rc="#40142A" delay={0.36} />
        </g>
        {/* 6 Digital */}
        <g filter="url(#bldShadow)">
          <Box x={4.3} y={1.5} w={1.2} d={1.0} h={1.6} tc="#0E2A4A" lc="#04101E" rc="#081E36" delay={0.32} />
          <Box x={4.45} y={1.6} w={0.95} d={0.82} h={2.6} tc="#143860" lc="#061426" rc="#0C2848" delay={0.40} />
          <Box x={4.55} y={1.68} w={0.75} d={0.65} h={3.2} tc="#183C70" lc="#081A30" rc="#103060" delay={0.48} />
        </g>
        {/* 7 Pilothall */}
        <g filter="url(#bldShadow)">
          <Box x={0.3} y={2.4} w={1.7} d={1.0} h={0.6} tc="#3A2416" lc="#16100A" rc="#281A10" delay={0.28} />
          <Box x={0.45} y={2.48} w={1.4} d={0.85} h={1.0} tc="#4A2E1A" lc="#1C1208" rc="#341C12" delay={0.36} />
        </g>
        {/* 8 Gatehouse */}
        <g filter="url(#bldShadow)">
          <Box x={-0.35} y={-0.7} w={0.55} d={0.35} h={0.8} tc="#4A3860" lc="#1A1428" rc="#302448" delay={0.5} />
          <Box x={0.28} y={-0.7} w={0.55} d={0.35} h={0.8} tc="#4A3860" lc="#1A1428" rc="#302448" delay={0.55} />
        </g>

        {/* Windows */}
        <Windows x={0.45} y={0.22} z={0.4} w={1.2} d={0.85} h={3.2} side="right" />
        <Windows x={0.45} y={0.22} z={0.4} w={1.2} d={0.85} h={3.2} side="left" />
        <Windows x={2.3} y={0.25} z={0.3} w={1.6} d={1.0} h={1.5} side="right" />
        <Windows x={4.45} y={1.6} z={0.4} w={0.95} d={0.82} h={2.2} side="right" />
        <Windows x={2.05} y={2.1} z={0.3} w={1.2} d={1.0} h={1.8} side="right" />

        {/* Glow halos */}
        <motion.ellipse cx={isoX(1.02, 0.62)} cy={isoY(1.02, 0.62, 4.3)}
          rx={55} ry={22} fill="url(#glowRed)"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }} />
        <motion.ellipse cx={isoX(4.9, 2.0)} cy={isoY(4.9, 2.0, 3.2)}
          rx={45} ry={18} fill="url(#glowBlue)"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }} />

        {/* Connecting lines */}
        {[
          { x1: -0.5, y1: 1.8, x2: 0.7, y2: 0.9, z: 0.12 },
          { x1: 1.4, y1: 0.6, x2: 2.5, y2: 0.6, z: 0.12 },
          { x1: 1.1, y1: 1.5, x2: 1.1, y2: 2.5, z: 0.12 },
          { x1: 0.7, y1: 3.0, x2: 2.2, y2: 2.6, z: 0.12 },
          { x1: 2.8, y1: 1.0, x2: 3.5, y2: 1.5, z: 0.12 },
        ].map(({ x1, y1, x2, y2, z }, i) => (
          <motion.line key={i}
            x1={isoX(x1, y1)} y1={isoY(x1, y1, z)}
            x2={isoX(x2, y2)} y2={isoY(x2, y2, z)}
            stroke="#BB0A21" strokeWidth="1" strokeDasharray="5 5" opacity={0.3}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ delay: 1.4 + i * 0.2, duration: 1.2 }}
          />
        ))}

        {/* Trees */}
        {([
          [-2.1, 0.1], [-2.1, 1.5], [-2.1, 2.8],
          [0.1, -1.0], [2.8, -0.5], [4.0, 0.2],
          [4.0, 1.5], [4.0, 2.8], [0.5, 4.2],
          [2.5, 3.8], [1.5, -0.9], [3.6, -0.6],
        ] as [number, number][]).map(([tx, ty], i) => (
          <Tree key={i} x={tx} y={ty} />
        ))}

        {/* Smoke */}
        <Smoke x={-1.0} y={0.88} z={5.0} />
        <Smoke x={-0.95} y={0.82} z={4.9} />

        {/* Department labels */}
        {DEPARTMENTS.map(({ id, label, anchorX, anchorY, anchorZ, color }, i) => (
          <motion.text key={id}
            x={isoX(anchorX, anchorY)} y={isoY(anchorX, anchorY, anchorZ)}
            textAnchor="middle"
            fill={activeDept === id ? color : "rgba(255,255,255,0.6)"}
            fontSize="11"
            fontFamily="'Inter', sans-serif"
            letterSpacing="0.1em"
            fontWeight="500"
            style={{ cursor: "pointer", transition: "fill 0.2s" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 + i * 0.1, duration: 0.7 }}
            onClick={(e) => { e.stopPropagation(); setActiveDept(id === activeDept ? null : id); }}
          >
            {label.toUpperCase()}
          </motion.text>
        ))}

        {/* Clickable hit zones — fill must be non-"transparent" to receive pointer events */}
        {DEPARTMENTS.map(({ id, hitX, hitY, hitW, hitD, hitH, color }) => (
          <polygon
            key={`hit-${id}`}
            points={hitZone(hitX, hitY, hitH, hitW, hitD)}
            fill="rgba(255,255,255,0.001)"
            stroke={activeDept === id ? color : "none"}
            strokeWidth="1.5"
            strokeOpacity={0.6}
            style={{ cursor: "pointer", pointerEvents: "all" }}
            data-testid={`hit-zone-${id}`}
            onClick={(e) => { e.stopPropagation(); setActiveDept(id === activeDept ? null : id); }}
          />
        ))}

        {/* People */}
        <Person x={-0.6} y={2.2} duration={5} delay={0} />
        <Person x={1.6} y={1.6} duration={7} delay={1.2} />
        <Person x={0.3} y={3.1} duration={6} delay={2} />
        <Person x={2.9} y={0.9} duration={8} delay={0.5} />
        <Person x={1.1} y={2.9} duration={5.5} delay={1.8} />
        <Person x={-0.2} y={1.0} duration={6.5} delay={3} />

        {/* Department popup — inside SVG so it scales/positions with the scene */}
        <AnimatePresence mode="wait">
          {selected && (() => {
            const CARD_W = 248;
            const CARD_H = 290;
            const ax = isoX(selected.anchorX, selected.anchorY);
            const ay = isoY(selected.anchorX, selected.anchorY, selected.anchorZ);
            // Flip card to the left if near right edge, below anchor if near top
            const goLeft = ax > W * 0.55;
            const goDown = ay < CARD_H + 20;
            const rawX = goLeft ? ax - CARD_W - 12 : ax + 12;
            const rawY = goDown ? ay + 12 : ay - CARD_H - 12;
            const cardX = Math.max(8, Math.min(W - CARD_W - 8, rawX));
            const cardY = Math.max(8, Math.min(H - CARD_H - 8, rawY));
            return (
              <DeptCard
                key={selected.id}
                dept={selected}
                cardX={cardX} cardY={cardY} cardW={CARD_W}
                onClose={() => setActiveDept(null)}
                onApply={() => navigate("/apply")}
              />
            );
          })()}
        </AnimatePresence>
      </svg>

      {/* Bottom vignette */}
      <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
        style={{ background: "linear-gradient(to top, #0A0A14 0%, transparent 100%)" }} />
    </div>
  );
}
