import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, User, Mail, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProfileBaselineSummary } from "@/components/ProfileBaselineSummary";
import { PersonalityProfileCard } from "@/components/PersonalityProfileCard";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

const Profile = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const [baselineData, { data: { user } }] = await Promise.all([
        getUserBaseline(),
        supabase.auth.getUser()
      ]);
      setBaseline(baselineData);
      setUserEmail(user?.email || null);
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success(t('signed_out') || 'Signed out successfully');
      navigate('/auth');
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error(t('sign_out_error') || 'Failed to sign out');
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const userName = baseline?.name || userEmail?.split('@')[0] || 'User';
  const initials = userName.charAt(0).toUpperCase();

  return (
    <AppLayout>
      <div className="p-4 space-y-6">
        {/* Header with Settings */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{t('profile') || 'Profile'}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* User Info Card */}
        <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-foreground truncate">{userName}</h2>
                {userEmail && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="truncate">{userEmail}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Baseline Summary */}
        <ProfileBaselineSummary baseline={baseline} />

        {/* Personality Profile */}
        <PersonalityProfileCard baseline={baseline} />

        {/* Sign Out */}
        <Button
          variant="outline"
          className="w-full rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t('sign_out') || 'Sign Out'}
        </Button>
      </div>
    </AppLayout>
  );
};

export default Profile;
