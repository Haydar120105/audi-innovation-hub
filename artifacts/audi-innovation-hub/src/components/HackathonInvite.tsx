import { useState } from "react";

const ACCENT = "#6B48FF";
const ACCENT_BG = "rgba(107,72,255,0.12)";
const ACCENT_BORDER = "rgba(107,72,255,0.3)";

export const HACKATHON_SLOTS = [
  { id: "jul-2026", date: "18. Juli 2026", day: "Samstag", time: "09:00–18:00 Uhr", spots: 23 },
  { id: "aug-2026", date: "15. August 2026", day: "Samstag", time: "09:00–18:00 Uhr", spots: 18 },
  { id: "sep-2026", date: "19. September 2026", day: "Samstag", time: "09:00–18:00 Uhr", spots: 31 },
  { id: "oct-2026", date: "17. Oktober 2026", day: "Samstag", time: "09:00–18:00 Uhr", spots: 40 },
];

interface Props {
  trackingToken: string;
  currentSlot: string | null | undefined;
}

export default function HackathonInvite({ trackingToken, currentSlot }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(currentSlot ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmedSlot = HACKATHON_SLOTS.find((s) => s.id === confirmed);

  async function handleConfirm() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/track/${trackingToken}/hackathon-slot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: selected }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Registration failed");
      }
      setConfirmed(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="mb-10 rounded-xl overflow-hidden"
      style={{ border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_BG }}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-start gap-4 mb-4">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(107,72,255,0.2)", border: `1px solid ${ACCENT_BORDER}` }}
          >
            {/* Lightning / hackathon icon */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M11 2L4 11h6l-1 7 7-9h-6l1-7z" stroke={ACCENT} strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-xs tracking-[0.2em] font-semibold uppercase mb-1" style={{ color: ACCENT }}>
              Alternative Pathway
            </p>
            <h2 className="text-white text-lg font-semibold leading-snug">
              Join the IPAI Innovation Hackathon
            </h2>
          </div>
        </div>

        <div
          className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg w-fit"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5A5.5 5.5 0 1 1 7 12.5A5.5 5.5 0 0 1 7 1.5z" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
            <path d="M7 4v3.5l2 1.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="text-white/40 text-xs font-medium">Heilbronn · IPAI Innovation Park · 2026</span>
        </div>

        <p className="text-white/55 text-sm leading-relaxed">
          We'd love to have you join us for a hands-on hackathon day at the IPAI Innovation Park in
          Heilbronn. Work in teams on a curated pool of real challenges from Audi departments — a
          chance to collaborate directly with Audi engineers, prototype ideas, and showcase your skills
          in an inspiring environment.
        </p>
      </div>

      {/* Confirmed state */}
      {confirmedSlot ? (
        <div className="px-6 pb-6">
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: "rgba(80,200,100,0.1)", border: "1px solid rgba(80,200,100,0.25)" }}
          >
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(80,200,100,0.2)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5L6.5 12L13 5" stroke="rgba(80,200,100,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "rgba(80,200,100,0.9)" }}>
                Spot confirmed!
              </p>
              <p className="text-white/50 text-xs mt-0.5">
                {confirmedSlot.day}, {confirmedSlot.date} · {confirmedSlot.time} · IPAI Heilbronn
              </p>
            </div>
          </div>
          <p className="text-white/30 text-xs mt-3 text-center">
            A confirmation will be sent to your registered email.
          </p>
        </div>
      ) : (
        /* Slot picker */
        <div className="px-6 pb-6">
          <p className="text-white/35 text-xs tracking-[0.18em] uppercase font-semibold mb-3">
            Choose your date
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {HACKATHON_SLOTS.map((slot) => {
              const isSelected = selected === slot.id;
              return (
                <button
                  key={slot.id}
                  onClick={() => setSelected(slot.id)}
                  className="p-3 rounded-xl text-left transition-all duration-150 active:scale-[0.98]"
                  style={{
                    background: isSelected ? "rgba(107,72,255,0.2)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSelected ? ACCENT : "rgba(255,255,255,0.07)"}`,
                  }}
                >
                  <p className="text-white text-xs font-semibold leading-snug">{slot.date}</p>
                  <p className="text-white/40 text-xs mt-0.5">{slot.day}</p>
                  <p className="text-white/30 text-xs mt-1">{slot.time}</p>
                  <p className="text-xs mt-1.5 font-medium" style={{ color: isSelected ? ACCENT : "rgba(255,255,255,0.2)" }}>
                    {slot.spots} spots left
                  </p>
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-red-400 text-xs mb-3 text-center">{error}</p>
          )}

          <button
            onClick={handleConfirm}
            disabled={!selected || loading}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: selected ? ACCENT : "rgba(107,72,255,0.3)",
              color: "white",
            }}
          >
            {loading ? "Registering…" : selected ? "Confirm my spot →" : "Select a date to register"}
          </button>
        </div>
      )}
    </div>
  );
}
