import { useState } from "react";
import { HACKATHON_SLOTS } from "./HackathonInvite";

const ACCENT = "#6B48FF";
const ACCENT_BORDER = "rgba(107,72,255,0.35)";
const ACCENT_BG = "rgba(107,72,255,0.1)";

interface Props {
  onContinueApplication: () => void;
  onSlotSelect: (slot: string) => void;
  preselectedSlot: string | null;
}

export default function HackathonRedirectCard({ onContinueApplication, onSlotSelect, preselectedSlot }: Props) {
  const [selected, setSelected] = useState<string | null>(preselectedSlot);
  const [registered, setRegistered] = useState(!!preselectedSlot);

  const confirmedSlot = HACKATHON_SLOTS.find((s) => s.id === selected);

  function handleRegister() {
    if (!selected) return;
    onSlotSelect(selected);
    setRegistered(true);
  }

  return (
    <div
      className="msg-in flex justify-start"
    >
      <div
        className="max-w-[90%] rounded-2xl rounded-tl-sm overflow-hidden"
        style={{ border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_BG }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(107,72,255,0.25)", border: `1px solid ${ACCENT_BORDER}` }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8.5 1.5L3.5 8.5h4.5L7.5 14.5l5-6.5H8l.5-6.5z" stroke={ACCENT} strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs tracking-[0.18em] font-semibold uppercase" style={{ color: ACCENT }}>
                Perfect match found
              </p>
              <p className="text-white text-sm font-semibold leading-tight">
                IPAI Innovation Hackathon
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg w-fit mb-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <path d="M5.5 3v2.5l1.5 1" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <span className="text-white/35 text-xs">Heilbronn · IPAI Innovation Park · 2026</span>
          </div>

          <p className="text-white/55 text-xs leading-relaxed">
            Spend a full day solving real-world challenges from Audi departments — hands-on, in teams, on-site.
            Great way to build connections, ship something real, and get your foot in the door.
          </p>
        </div>

        {registered && confirmedSlot ? (
          /* Confirmed state */
          <div className="px-5 pb-5">
            <div
              className="flex items-start gap-3 p-3.5 rounded-xl mb-4"
              style={{ background: "rgba(80,200,100,0.1)", border: "1px solid rgba(80,200,100,0.25)" }}
            >
              <div
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                style={{ background: "rgba(80,200,100,0.2)" }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6.5L4.5 9L10 3.5" stroke="rgba(80,200,100,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "rgba(80,200,100,0.9)" }}>
                  Slot saved!
                </p>
                <p className="text-white/45 text-xs mt-0.5">
                  {confirmedSlot.day}, {confirmedSlot.date} · {confirmedSlot.time}
                </p>
                <p className="text-white/30 text-xs mt-1">
                  We'll confirm your spot after you complete the application.
                </p>
              </div>
            </div>
            <button
              onClick={onContinueApplication}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-all duration-150 active:scale-[0.98]"
              style={{ background: ACCENT }}
            >
              Proceed with application →
            </button>
          </div>
        ) : (
          /* Slot picker */
          <div className="px-5 pb-5">
            <p className="text-white/30 text-xs tracking-[0.15em] uppercase font-semibold mb-2.5">
              Pick a date
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {HACKATHON_SLOTS.map((slot) => {
                const isSelected = selected === slot.id;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelected(slot.id)}
                    className="p-3 rounded-xl text-left transition-all duration-150 active:scale-[0.97]"
                    style={{
                      background: isSelected ? "rgba(107,72,255,0.22)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isSelected ? ACCENT : "rgba(255,255,255,0.07)"}`,
                    }}
                  >
                    <p className="text-white text-xs font-semibold leading-snug">{slot.date}</p>
                    <p className="text-white/40 text-xs mt-0.5">{slot.day}</p>
                    <p className="text-white/30 text-xs mt-0.5">{slot.time}</p>
                    <p className="text-xs mt-1.5 font-medium" style={{ color: isSelected ? ACCENT : "rgba(255,255,255,0.2)" }}>
                      {slot.spots} spots left
                    </p>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleRegister}
              disabled={!selected}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white mb-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: selected ? ACCENT : "rgba(107,72,255,0.35)" }}
            >
              {selected ? "Register for Hackathon →" : "Select a date above"}
            </button>

            <button
              onClick={onContinueApplication}
              className="w-full py-2 text-xs font-medium transition-colors duration-150"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Continue with full Innovation Hub application instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
