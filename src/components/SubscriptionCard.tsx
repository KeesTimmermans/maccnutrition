import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, ExternalLink, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  "Wearable device integration",
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

  const handleSubscribe = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error('Failed to open subscription management. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Crown className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">MACCnutrition Premium</CardTitle>
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
