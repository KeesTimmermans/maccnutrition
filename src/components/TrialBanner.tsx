import { AlertTriangle, Clock, X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TrialBannerProps {
  daysRemaining: number;
  trialEnd: string;
}

export const TrialBanner = ({ daysRemaining, trialEnd }: TrialBannerProps) => {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (dismissed) return null;

  const isUrgent = daysRemaining <= 3;
  const formattedDate = new Date(trialEnd).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      toast.error('Failed to open subscription portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`relative rounded-xl p-4 flex items-center gap-3 animate-fade-in ${
        isUrgent
          ? "bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30"
          : "bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUrgent ? "bg-red-500/20" : "bg-amber-500/20"
        }`}
      >
        {isUrgent ? (
          <AlertTriangle className="w-5 h-5 text-red-500" />
        ) : (
          <Clock className="w-5 h-5 text-amber-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${isUrgent ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
          {isUrgent
            ? `Trial expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}!`
            : `${daysRemaining} days left in your trial`}
        </p>
        <p className="text-xs text-muted-foreground">
          Ends {formattedDate} • Upgrade to keep all features
        </p>
      </div>

      <button
        onClick={handleUpgrade}
        disabled={loading}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
          isUrgent
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-amber-500 text-white hover:bg-amber-600"
        } disabled:opacity-50`}
      >
        {loading ? "..." : "Upgrade"}
      </button>

      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
};
