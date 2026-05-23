import { Link } from "wouter";
import { UserButton, useAuth } from "@clerk/clerk-react";
import PlantScene from "../components/PlantScene";
import Benefits from "../components/Benefits";
import FocusAreas from "../components/FocusAreas";
import Testimonials from "../components/Testimonials";

function TopRightNav() {
  const { sessionClaims, isSignedIn, isLoaded } = useAuth();
  const meta = sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
  const role = meta?.["role"] as string | undefined;
  const isSuperuser = role === "superuser";
  const isStaff = role === "audi_staff" || isSuperuser;

  if (!isLoaded) return null;

  const ghost = {
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.1)",
    backdropFilter: "blur(8px)",
  };

  // Role badge config
  const roleBadge = isSuperuser
    ? { label: "Admin", color: "rgba(245,158,11,0.85)", border: "rgba(245,158,11,0.25)" }
    : isStaff
    ? { label: "Audi Staff", color: "rgba(255,255,255,0.65)", border: "rgba(255,255,255,0.15)" }
    : role
    ? { label: "Applicant", color: "rgba(255,255,255,0.4)", border: "rgba(255,255,255,0.08)" }
    : null;

  // Dashboard destination depends on role
  const dashboardHref = isSuperuser ? "/admin" : isStaff ? "/applications" : "/dashboard";
  const dashboardStyle = isSuperuser
    ? { ...ghost, color: "rgba(245,158,11,0.85)", border: "1px solid rgba(245,158,11,0.22)" }
    : ghost;

  return (
    <div className="fixed top-5 right-6 z-50 flex items-center gap-2">
      {isSignedIn ? (
        <>
          {/* Role badge */}
          {roleBadge && (
            <span
              className="px-2.5 py-1 text-[11px] font-semibold rounded-sm tracking-wide"
              style={{
                color: roleBadge.color,
                border: `1px solid ${roleBadge.border}`,
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(8px)",
              }}
            >
              {roleBadge.label}
            </span>
          )}

          {/* Single Dashboard button — routes to role-specific view */}
          <Link href={dashboardHref}>
            <button
              className="px-3 py-1.5 text-xs font-semibold rounded-sm hidden sm:inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
              style={dashboardStyle}
            >
              Dashboard
            </button>
          </Link>

          <UserButton afterSignOutUrl="/" />
        </>
      ) : (
        <>
          <Link href="/sign-in">
            <button
              className="px-4 py-2 text-xs font-semibold rounded-sm transition-opacity hover:opacity-80"
              style={ghost}
            >
              Log in
            </button>
          </Link>
          <Link href="/sign-up">
            <button
              className="px-4 py-2 text-xs font-semibold rounded-sm text-white transition-opacity hover:opacity-85"
              style={{ background: "#BB0A21" }}
            >
              Register
            </button>
          </Link>
        </>
      )}
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
      <Testimonials />
    </div>
  );
}
