import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LifestyleStep,
  EatingBehaviorStep,
  ChallengesStep,
  GoalsStep,
  PreferencesStep,
  type OnboardingData,
} from "@/components/OnboardingQuestionnaire";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { baselineToOnboardingData, saveProfileSection, type UserBaseline } from "@/lib/userService";
import {
  PROFILE_SECTIONS,
  getIncompleteSections,
  sectionPrefill,
  sectionToBaselineFields,
  type SectionId,
} from "@/lib/profileSections";

const DISMISS_KEY = "profile-card-dismissed-until";
const DISMISS_DAYS = 7;

const readDismissedUntil = (): number => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

interface ProfileCompletionCardProps {
  baseline: UserBaseline | null;
  onSaved: () => void;
}

export const ProfileCompletionCard = ({ baseline, onSaved }: ProfileCompletionCardProps) => {
  const { t } = useLanguage();
  const [dismissedUntil, setDismissedUntil] = useState<number>(() => readDismissedUntil());
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const [initialData, setInitialData] = useState<OnboardingData | null>(null);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [saving, setSaving] = useState(false);

  const incomplete = useMemo(() => getIncompleteSections(baseline), [baseline]);

  if (!baseline || incomplete.length === 0 || dismissedUntil > Date.now()) return null;

  const handleDismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      // Storage unavailable — hide for this visit only
    }
    setDismissedUntil(until);
  };

  const openFor = (id: SectionId) => {
    const prefilled = { ...baselineToOnboardingData(baseline), ...sectionPrefill(baseline) } as OnboardingData;
    setInitialData(prefilled);
    setData(prefilled);
    setOpenSection(id);
  };

  const close = () => {
    if (saving) return;
    setOpenSection(null);
  };

  const updateData = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const toggleArrayItem = (key: keyof OnboardingData, item: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const current = prev[key] as string[];
      const updated = current.includes(item) ? current.filter((i) => i !== item) : [...current, item];
      return { ...prev, [key]: updated };
    });
  };

  const hasChanges =
    !!openSection &&
    !!data &&
    !!initialData &&
    JSON.stringify(sectionToBaselineFields(openSection, data)) !==
      JSON.stringify(sectionToBaselineFields(openSection, initialData));

  const handleSave = async () => {
    if (!openSection || !data) return;
    setSaving(true);
    try {
      await saveProfileSection(sectionToBaselineFields(openSection, data));
      toast.success("Saved");
      setOpenSection(null);
      onSaved();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const section = PROFILE_SECTIONS.find((s) => s.id === openSection);
  const stepProps = data ? { data, updateData, toggleArrayItem, t } : null;

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-foreground">Complete your profile</h3>
        <p className="text-sm text-muted-foreground">A minute here makes Coach Mac's advice more personal.</p>
        <p className="text-xs text-muted-foreground mt-1">
          {PROFILE_SECTIONS.length - incomplete.length} of {PROFILE_SECTIONS.length} sections done
        </p>
      </div>

      <div className="space-y-2">
        {PROFILE_SECTIONS.filter((s) => incomplete.includes(s.id)).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => openFor(s.id)}
            className="w-full flex items-center justify-between gap-3 rounded-xl bg-muted/50 hover:bg-muted px-3 py-2.5 text-left transition-colors"
          >
            <div className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{s.title}</span>
              <span className="block text-xs text-muted-foreground">{s.questionCount} questions</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-muted-foreground">
          Not now
        </Button>
      </div>

      <Dialog open={!!openSection} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-md p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 text-left">
            <DialogTitle>{section?.title}</DialogTitle>
            <DialogDescription>All questions are optional.</DialogDescription>
          </DialogHeader>

          <div className="px-5 pb-4">
            {stepProps && openSection === "training" && <LifestyleStep {...stepProps} extrasOnly />}
            {stepProps && openSection === "eating" && <EatingBehaviorStep {...stepProps} />}
            {stepProps && openSection === "journey" && (
              <div className="space-y-6">
                <ChallengesStep {...stepProps} />
                <GoalsStep {...stepProps} extrasOnly />
              </div>
            )}
            {stepProps && openSection === "food" && (
              <PreferencesStep data={stepProps.data} updateData={updateData} t={t} extrasOnly />
            )}
          </div>

          <div className="sticky bottom-0 flex gap-3 border-t border-border bg-background px-5 py-3">
            <Button variant="outline" className="flex-1" onClick={close} disabled={saving}>
              Skip for now
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={!hasChanges || saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
