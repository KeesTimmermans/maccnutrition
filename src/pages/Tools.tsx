import { Link } from "react-router-dom";
import { ChevronRight, ScanBarcode, type LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";

interface ToolEntry {
  to: string;
  icon: LucideIcon;
  nameKey: string;
  descriptionKey: string;
}

/** Add a tool by adding one entry here. */
const TOOLS: ToolEntry[] = [
  {
    to: "/tools/scan",
    icon: ScanBarcode,
    nameKey: "tool_scan_rate_name",
    descriptionKey: "tool_scan_rate_desc",
  },
];

const Tools = () => {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="p-4 space-y-5">
        <header className="pt-2">
          <h1 className="text-2xl font-bold text-foreground">{t("tools_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("tools_subtitle")}</p>
        </header>

        <div className="space-y-3">
          {TOOLS.map(({ to, icon: Icon, nameKey, descriptionKey }) => (
            <Link key={to} to={to} className="block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="bg-card rounded-3xl shadow-medium p-4 flex items-center gap-4 transition-transform active:scale-[0.99]">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{t(nameKey)}</p>
                  <p className="text-sm text-muted-foreground">{t(descriptionKey)}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Tools;
