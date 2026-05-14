import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, useUser, useAuth, useClerk } from "@clerk/react";
import { dark } from "@clerk/themes";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import CharacterCreate from "@/pages/CharacterCreate";
import Campaigns from "@/pages/Campaigns";
import CampaignCreate from "@/pages/CampaignCreate";
import GameSession from "@/pages/GameSession";
import NoticeBoard from "@/pages/NoticeBoard";
import Achievements from "@/pages/Achievements";
import AdminDashboard from "@/pages/AdminDashboard";
import { auth } from "@/lib/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || "";
const API_BASE = import.meta.env.VITE_API_URL || "";

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: dark,
  cssLayerName: "clerk" as const,
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
  },
  variables: {
    colorPrimary: "hsl(var(--primary))",
    colorForeground: "hsl(var(--foreground))",
    colorMutedForeground: "hsl(var(--muted-foreground))",
    colorDanger: "hsl(var(--destructive))",
    colorBackground: "hsl(var(--background))",
    colorInput: "var(--input-bg)",
    colorInputForeground: "var(--input-fg)",
    colorNeutral: "hsl(var(--border))",
    fontFamily: "'Crimson Text', Georgia, serif",
    borderRadius: "12px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "bg-card rounded-2xl w-[440px] max-w-full overflow-hidden border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-2xl",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-b-2xl",
    headerTitle: "text-primary font-serif",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground",
    formFieldLabel: "text-muted-foreground",
    footerActionLink: "text-primary",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-400",
    alertText: "text-foreground",
    logoBox: "hidden",
    logoImage: "hidden",
    socialButtonsBlockButton: "border border-border bg-foreground/[0.04] hover:bg-foreground/[0.08]",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
    formFieldInput: "border-border text-foreground",
    footerAction: "border-t border-border",
    dividerLine: "bg-border",
    alert: "border-border",
    otpCodeFieldInput: "border-border text-foreground",
    main: "gap-4",
  },
};

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function ClerkSyncGate({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    const localUser = auth.getUser();

    if (user && !localUser) {
      getToken()
        .then(async (token) => {
          try {
            const res = await fetch(`${API_BASE}/api/players/clerk-sync`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                displayName: user.fullName || user.username || undefined,
                email: user.primaryEmailAddress?.emailAddress,
              }),
            });
            const data = await res.json();
            if (res.ok) {
              auth.setUser({ id: data.id, username: data.username, role: String(data.role ?? "").toLowerCase() });
            }
          } catch {
          }
          setReady(true);
        })
        .catch(() => setReady(true));
    } else {
      setReady(true);
    }
  }, [isLoaded, user]);

  if (!isLoaded || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary font-display text-xl animate-pulse">Channeling arcane energies...</div>
      </div>
    );
  }

  return <>{children}</>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl || undefined}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkSyncGate>
            <Switch>
              <Route path="/" component={Landing} />
              <Route path="/login" component={Login} />
              <Route path="/signup" component={Signup} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/character/new" component={CharacterCreate} />
              <Route path="/campaigns" component={Campaigns} />
              <Route path="/campaign/new" component={CampaignCreate} />
              <Route path="/game/:sessionId" component={GameSession} />
              <Route path="/notices" component={NoticeBoard} />
              <Route path="/achievements" component={Achievements} />
              <Route path="/admin" component={AdminDashboard} />
              <Route component={NotFound} />
            </Switch>
          </ClerkSyncGate>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
