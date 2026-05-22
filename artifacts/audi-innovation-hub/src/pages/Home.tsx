import { Link } from "wouter";
import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/clerk-react";
import PlantScene from "../components/PlantScene";
import Benefits from "../components/Benefits";
import FocusAreas from "../components/FocusAreas";

function TopRightNav() {
  const { sessionClaims } = useAuth();
  const meta = sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
  const role = meta?.["role"] as string | undefined;
  const isSuperuser = role === "superuser";
  const isStaff = role === "audi_staff" || isSuperuser;

  const btnStyle = {
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.1)",
    backdropFilter: "blur(8px)",
  };

  return (
    <div className="fixed top-5 right-6 z-50 flex items-center gap-2">
      <SignedIn>
        {isSuperuser && (
          <Link href="/admin">
            <button className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-all hidden sm:inline-flex items-center gap-1.5"
              style={{ ...btnStyle, color: "rgba(245,158,11,0.8)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <circle cx="5.5" cy="4" r="2" stroke="currentColor" strokeWidth="1.1"/>
                <path d="M1 10c0-2.5 2-3.5 4.5-3.5S10 7.5 10 10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              Admin
            </button>
          </Link>
        )}
        {isStaff && (
          <Link href="/applications">
            <button className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-all hidden sm:inline-flex items-center gap-1.5"
              style={btnStyle}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="opacity-60">
                <rect x="0.5" y="0.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
                <rect x="6.5" y="0.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
                <rect x="0.5" y="6.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
                <rect x="6.5" y="6.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1"/>
              </svg>
              Dashboard
            </button>
          </Link>
        )}
        <UserButton afterSignOutUrl="/" />
      </SignedIn>

      <SignedOut>
        <Link href="/sign-in">
          <button className="px-4 py-2 text-xs font-semibold rounded-sm transition-all flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M1 12c0-3 2.5-4.5 5.5-4.5S12 9 12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Staff Login
          </button>
        </Link>
      </SignedOut>
    </div>
  );
}

export default function Home() {
  return (
    <div className="w-full min-h-screen bg-[#0A0A14] text-white overflow-y-auto">
      <TopRightNav />

      <div className="w-full" style={{ height: "100svh" }}>
        <PlantScene />
      </div>
      <FocusAreas />
      <Benefits />
    </div>
  );
}
