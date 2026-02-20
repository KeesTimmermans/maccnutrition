import { NavLink } from "@/components/NavLink";
import { Home, TrendingUp, UtensilsCrossed, Activity, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Home, label: "Today" },
  { to: "/progress", icon: TrendingUp, label: "Progress" },
  { to: "/meals", icon: UtensilsCrossed, label: "Meals" },
  { to: "/metrics", icon: Activity, label: "Metrics" },
  { to: "/community", icon: Users, label: "Community" },
];

export const BottomNav = () => {
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
