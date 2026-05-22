import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import Apply from "@/pages/Apply";
import { ApplicationsList, ApplicationDetail } from "@/pages/Applications";
import { DepartmentsList, DepartmentView } from "@/pages/DepartmentPortal";
import Track from "@/pages/Track";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/apply" component={Apply} />
      <Route path="/applications" component={ApplicationsList} />
      <Route path="/applications/:id" component={ApplicationDetail} />
      <Route path="/departments" component={DepartmentsList} />
      <Route path="/departments/:departmentId" component={DepartmentView} />
      <Route path="/track/:token" component={Track} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
