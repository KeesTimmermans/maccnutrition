import { NavLink } from "@/components/NavLink";
import { Home, TrendingUp, Activity, Users, User, Wrench } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/App";
import { useNavigate } from "react-router-dom";

const navItems: Array<{ to: string; icon: typeof Home; label: string; labelKey?: string }> = [
  { to: "/dashboard", icon: Home, label: "Today" },
  { to: "/progress", icon: TrendingUp, label: "Progress" },
  { to: "/metrics", icon: Activity, label: "Metrics" },
  { to: "/community", icon: Users, label: "Community" },
  { to: "/tools", icon: Wrench, label: "Tools", labelKey: "nav_tools" },
  { to: "/profile", icon: User, label: "Profile" },
];

export const BottomNav = () => {
  const { onboardingCompleted } = useOnboarding();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Show a clickable CTA when onboarding is incomplete
  if (onboardingCompleted === false) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-center h-16 max-w-lg mx-auto px-4">
          <button
            onClick={() => {
              if (import.meta.env.DEV) {
                console.log("CTA clicked, navigating to", "/onboarding", "current path:", location.pathname, location.hash);
              }
              navigate("/onboarding");
            }}
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors active:scale-[0.98]"
          >
            Finish setup →
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16 max-w-lg mx-auto px-1 py-1.5">
        {navItems.map(({ to, icon: Icon, label, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 rounded-xl transition-colors text-muted-foreground hover:text-foreground"
            activeClassName="text-primary bg-primary/10"
          >
            <Icon className="w-5 h-5" />
            <span className="w-full text-center text-[11px] leading-tight font-medium tracking-tight truncate">
              {labelKey ? t(labelKey) : label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
