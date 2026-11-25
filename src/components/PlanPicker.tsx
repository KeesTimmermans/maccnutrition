import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PLANS, TRIAL_DAYS, formatGbp, yearlyPerMonthPence, yearlySavingPence, yearlySavingPercent,
  type PlanId,
} from "../../supabase/functions/_shared/plans";

interface PlanPickerProps {
  value: PlanId;
  onChange: (plan: PlanId) => void;
}

const trialEndDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

export const PlanPicker = ({ value, onChange }: PlanPickerProps) => {
  const options: { id: PlanId; title: string; price: string; sub?: string }[] = [
    {
      id: "yearly",
      title: "Yearly",
      price: `${formatGbp(PLANS.yearly.pence)}/year`,
      sub: `${formatGbp(yearlyPerMonthPence())}/month, save ${formatGbp(yearlySavingPence())} (${yearlySavingPercent()}%)`,
    },
    { id: "monthly", title: "Monthly", price: `${formatGbp(PLANS.monthly.pence)}/month` },
  ];

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Choose a plan" className="grid gap-2">
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.id)}
              className={cn(
                "w-full rounded-xl border-2 p-3 text-left transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full border-2",
                      selected ? "border-primary bg-primary" : "border-muted-foreground/40",
                    )}
                  />
                  <span className="font-semibold text-foreground">{o.title}</span>
                  {o.id === "yearly" && <Badge className="text-[10px]">Best value</Badge>}
                </div>
                <span className="font-semibold text-foreground">{o.price}</span>
              </div>
              {o.sub && <p className="mt-1 pl-6 text-xs text-muted-foreground">{o.sub}</p>}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {TRIAL_DAYS}-day free trial, then {formatGbp(PLANS[value].pence)} on {trialEndDate()}. Cancel anytime.
      </p>
    </div>
  );
};

export default PlanPicker;
