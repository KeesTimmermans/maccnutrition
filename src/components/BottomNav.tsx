import { NavLink } from "@/components/NavLink";
import { Home, TrendingUp, UtensilsCrossed, Activity, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/App";

const navItems = [
  { to: "/", icon: Home, label: "Today" },
  { to: "/progress", icon: TrendingUp, label: "Progress" },
  { to: "/meals", icon: UtensilsCrossed, label: "Meals" },
  { to: "/metrics", icon: Activity, label: "Metrics" },
  { to: "/community", icon: Users, label: "Community" },
  { to: "/profile", icon: User, label: "Profile" },
];

export const BottomNav = () => {
  const { onboardingCompleted } = useOnboarding();

  // Hide nav entirely when onboarding is incomplete
  if (onboardingCompleted === false) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-center h-16 max-w-lg mx-auto px-4">
          <p className="text-xs text-muted-foreground">Complete onboarding to continue.</p>
        </div>
      </nav>
    );
  }

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-colors min-w-[64px] text-muted-foreground hover:text-foreground"
            activeClassName="text-primary bg-primary/10"
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
