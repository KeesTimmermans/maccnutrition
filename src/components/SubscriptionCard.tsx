import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, ExternalLink, Check, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SubscriptionCardProps {
  subscribed: boolean;
  subscriptionEnd: string | null;
  onRefresh: () => void;
  loading: boolean;
}

const features = [
  "AI Nutrition Coach with personalized advice",
  "Custom meal plans tailored to your goals",
  "Detailed progress tracking & analytics",
  
  "Unlimited meal logging & history",
  "Priority support",
];

export const SubscriptionCard = ({ 
  subscribed, 
  subscriptionEnd, 
  onRefresh, 
  loading 
}: SubscriptionCardProps) => {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const getCheckoutReturnUrl = () => {
    const basePath = window.location.pathname.endsWith("/")
      ? window.location.pathname
      : `${window.location.pathname}/`;
    return `${window.location.origin}${basePath}#/`;
  };

  const handleSubscribe = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { return_url: getCheckoutReturnUrl() },
      });
      if (error) throw error;
      if (data?.url) {
        const opened = window.open(data.url, "_blank", "noopener,noreferrer");
        if (!opened) window.location.assign(data.url);
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    // Pre-open a tab synchronously so popup blockers don't kill it after the
    // async edge function call.
    const newTab = window.open("about:blank", "_blank", "noopener,noreferrer");
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        if (newTab) {
          newTab.location.href = data.url;
        } else {
          window.location.assign(data.url);
        }
      } else {
        newTab?.close();
        throw new Error("No portal URL returned");
      }
    } catch (error) {
      newTab?.close();
      console.error("Error opening customer portal:", error);
      toast.error("Failed to open subscription management. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription");
      if (error) throw error;
      if (data?.success) {
        const endDate = data.current_period_end
          ? new Date(data.current_period_end * 1000).toLocaleDateString()
          : subscriptionEnd
            ? new Date(subscriptionEnd).toLocaleDateString()
            : "the end of your billing period";
        toast.success(
          data.alreadyScheduled
            ? `Your subscription is already set to cancel on ${endDate}.`
            : `Subscription cancelled. You'll keep access until ${endDate}.`
        );
        setCancelDialogOpen(false);
        onRefresh();
      } else {
        throw new Error(data?.error || "Cancellation failed");
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      const message =
        error instanceof Error ? error.message : "Failed to cancel subscription";
      toast.error(message);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Crown className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">MacNutrition Premium</CardTitle>
        <CardDescription>
          {subscribed 
            ? "You have full access to all premium features" 
            : "Unlock all features with a premium subscription"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {subscribed ? (
          <>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                Active Subscription
              </Badge>
            </div>
            {subscriptionEnd && (
              <p className="text-center text-sm text-muted-foreground">
                Next billing date: {new Date(subscriptionEnd).toLocaleDateString()}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleManageSubscription} 
                variant="outline"
                disabled={portalLoading}
                className="w-full"
              >
                {portalLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Manage Subscription
              </Button>
              
              <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll continue to have access until {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : 'the end of your billing period'}. 
                      After that, you'll lose access to premium features including AI coaching, meal plans, and detailed analytics.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancelLoading}>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        handleCancelSubscription();
                      }}
                      disabled={cancelLoading}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {cancelLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {cancelLoading ? "Cancelling…" : "Cancel Subscription"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>


              <Button 
                onClick={onRefresh} 
                variant="ghost" 
                size="sm"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Refresh Status
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <span className="text-3xl font-bold">£9.99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button 
              onClick={handleSubscribe} 
              className="w-full"
              disabled={checkoutLoading}
            >
              {checkoutLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Crown className="mr-2 h-4 w-4" />
              )}
              Subscribe Now
            </Button>
            <Button 
              onClick={onRefresh} 
              variant="ghost" 
              size="sm"
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Already subscribed? Refresh
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
