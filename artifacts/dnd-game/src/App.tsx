import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, useUser, useAuth, useClerk } from "@clerk/react";
import { dark } from "@clerk/themes";

import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import CharacterCreate from "@/pages/CharacterCreate";
import Campaigns from "@/pages/Campaigns";
import CampaignCreate from "@/pages/CampaignCreate";
import GameSession from "@/pages/GameSession";
import NoticeBoard from "@/pages/NoticeBoard";
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
    colorPrimary: "#d4af37",
    colorForeground: "#f0e6d3",
    colorMutedForeground: "#8b7d6b",
    colorDanger: "#c0392b",
    colorBackground: "#0d0a10",
    colorInput: "#1a1520",
    colorInputForeground: "#f0e6d3",
    colorNeutral: "#3d3545",
    fontFamily: "'Crimson Text', Georgia, serif",
    borderRadius: "0px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "bg-[#0d0a10] rounded-none w-[440px] max-w-full overflow-hidden border border-[#3d3545]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#d4af37] font-serif",
    headerSubtitle: "text-[#8b7d6b]",
    socialButtonsBlockButtonText: "text-[#f0e6d3]",
    formFieldLabel: "text-[#8b7d6b]",
    footerActionLink: "text-[#d4af37]",
    footerActionText: "text-[#8b7d6b]",
    dividerText: "text-[#8b7d6b]",
    identityPreviewEditButton: "text-[#d4af37]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-[#f0e6d3]",
    logoBox: "hidden",
    logoImage: "hidden",
    socialButtonsBlockButton: "border border-[#3d3545] bg-[#1a1520] hover:bg-[#251d30]",
    formButtonPrimary: "bg-[#d4af37] text-black hover:bg-[#b8963e]",
    formFieldInput: "bg-[#1a1520] border-[#3d3545] text-[#f0e6d3]",
    footerAction: "border-t border-[#3d3545]",
    dividerLine: "bg-[#3d3545]",
    alert: "border-[#3d3545]",
    otpCodeFieldInput: "bg-[#1a1520] border-[#3d3545] text-[#f0e6d3]",
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
              <Route path="/" component={Login} />
              <Route path="/signup" component={Signup} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/character/new" component={CharacterCreate} />
              <Route path="/campaigns" component={Campaigns} />
              <Route path="/campaign/new" component={CampaignCreate} />
              <Route path="/game/:sessionId" component={GameSession} />
              <Route path="/notices" component={NoticeBoard} />
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
