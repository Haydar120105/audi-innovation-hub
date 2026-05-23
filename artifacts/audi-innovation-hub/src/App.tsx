import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useUser } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import Apply from "@/pages/Apply";
import { ApplicationsList, ApplicationDetail } from "@/pages/Applications";
import { DepartmentsList, DepartmentView } from "@/pages/DepartmentPortal";
import Track from "@/pages/Track";
import SignInPage from "@/pages/SignIn";
import SignUpPage from "@/pages/SignUp";
import AdminDashboard from "@/pages/Admin";
import ApplicantDashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!PUBLISHABLE_KEY) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set in the environment.");
}

const queryClient = new QueryClient();

/** Wraps a component so it redirects to /sign-in if not authenticated. */
function Protected({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

/** Wraps a component so it redirects to /sign-in AND requires audi_staff role. */
function AudiStaffOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return null;
  if (!user) return <RedirectToSignIn />;
  const role = user.publicMetadata?.["role"] as string | undefined;
  // superusers can also access staff pages
  if (role !== "audi_staff" && role !== "superuser") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A14" }}>
        <div className="text-center">
          <p className="text-white/40 text-sm">Access restricted to Audi staff.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** Wraps a component — requires superuser role. */
function SuperuserOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return null;
  if (!user) return <RedirectToSignIn />;
  if (user.publicMetadata?.["role"] !== "superuser") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A14" }}>
        <div className="text-center">
          <p className="text-white/40 text-sm mb-2">Access restricted to superusers.</p>
          <a href="/" className="text-white/25 text-xs underline">← Home</a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * Redirects superusers → /admin, Audi staff → /applications.
 *
 * Uses useUser() (not sessionClaims) so that publicMetadata is always
 * fresh — no re-login required after a role change in the Clerk dashboard.
 */
function DashboardRouter() {
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();

  // Read directly from user.publicMetadata — always up to date
  const role = user?.publicMetadata?.["role"] as string | undefined;

  useEffect(() => {
    if (!isLoaded) return;
    if (role === "superuser") setLocation("/admin");
    else if (role === "audi_staff") setLocation("/applications");
  }, [isLoaded, role]); // intentionally omit setLocation (stable ref, avoids re-fires)

  // Show nothing while loading or while the redirect fires
  if (!isLoaded || role === "superuser" || role === "audi_staff") return null;

  return <ApplicantDashboard />;
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      {/* Catch all /sign-in and /sign-up sub-paths Clerk navigates to internally */}
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-in/:rest*" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route path="/sign-up/:rest*" component={SignUpPage} />
      <Route path="/track/:token" component={Track} />

      {/* Applicants + staff */}
      <Route path="/dashboard">
        <Protected><DashboardRouter /></Protected>
      </Route>
      <Route path="/apply">
        <Protected><Apply /></Protected>
      </Route>
      <Route path="/applications">
        <AudiStaffOnly><ApplicationsList /></AudiStaffOnly>
      </Route>
      <Route path="/applications/:id">
        <Protected><ApplicationDetail /></Protected>
      </Route>

      {/* Audi staff only */}
      <Route path="/departments">
        <AudiStaffOnly><DepartmentsList /></AudiStaffOnly>
      </Route>
      <Route path="/departments/:departmentId">
        <AudiStaffOnly><DepartmentView /></AudiStaffOnly>
      </Route>

      {/* Superuser only */}
      <Route path="/admin">
        <SuperuserOnly><AdminDashboard /></SuperuserOnly>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={base}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
