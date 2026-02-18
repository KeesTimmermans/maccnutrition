import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from "@/lib/consentConstants";

interface ReConsentModalProps {
  userId: string;
  onAccepted: () => void;
}

export const ReConsentModal = ({ userId, onAccepted }: ReConsentModalProps) => {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedHealth, setAcceptedHealth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleAccept = async () => {
    if (!acceptedTerms || !acceptedHealth) return;
    setSaving(true);

    const now = new Date().toISOString();

    await supabase.from("user_baselines").upsert(
      {
        user_id: userId,
        privacy_policy_accepted: true,
        privacy_policy_version: PRIVACY_POLICY_VERSION,
        privacy_policy_accepted_at: now,
        terms_accepted: true,
        terms_version: TERMS_VERSION,
        terms_accepted_at: now,
        health_data_consent: true,
        health_data_consent_at: now,
      },
      { onConflict: "user_id" }
    );

    await supabase.from("consent_log").insert([
      { user_id: userId, consent_type: "privacy", policy_version: PRIVACY_POLICY_VERSION, accepted: true, accepted_at: now },
      { user_id: userId, consent_type: "terms",   policy_version: TERMS_VERSION,          accepted: true, accepted_at: now },
      { user_id: userId, consent_type: "health",  policy_version: PRIVACY_POLICY_VERSION, accepted: true, accepted_at: now },
    ]);

    setSaving(false);
    onAccepted();
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    // Auth state change listener in App.tsx will reset state
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">Consent Required</h1>
          <p className="text-sm text-muted-foreground">
            Please review and accept our Privacy Policy, Terms &amp; Conditions, and health data
            consent to continue using MacNutrition.
          </p>
        </div>

        <div className="space-y-4">
          {/* Required: Terms & Privacy */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="reconsent-terms"
              checked={acceptedTerms}
              onCheckedChange={(v) => setAcceptedTerms(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="reconsent-terms" className="text-sm text-muted-foreground leading-snug cursor-pointer">
              I agree to the{" "}
              <a
                href="#/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Privacy Policy
              </a>{" "}
              and{" "}
              <a
                href="#/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Terms &amp; Conditions
              </a>
              {" "}<span className="text-destructive">*</span>
            </label>
          </div>

          {/* Required: Health data consent */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="reconsent-health"
              checked={acceptedHealth}
              onCheckedChange={(v) => setAcceptedHealth(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="reconsent-health" className="text-sm text-muted-foreground leading-snug cursor-pointer">
              I consent to the processing of my health-related data as described in the{" "}
              <a
                href="#/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Privacy Policy
              </a>
              {" "}<span className="text-destructive">*</span>
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            <span className="text-destructive">*</span> Required
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="hero"
            size="lg"
            className="w-full"
            disabled={!acceptedTerms || !acceptedHealth || saving || loggingOut}
            onClick={handleAccept}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Agree & Continue"
            )}
          </Button>

          <Button
            variant="ghost"
            size="lg"
            className="w-full text-muted-foreground"
            disabled={saving || loggingOut}
            onClick={handleLogout}
          >
            {loggingOut ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing out…
              </>
            ) : (
              "Log out"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
