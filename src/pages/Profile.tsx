import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Mail, LogOut, Loader2, Lock, ChevronRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProfileBaselineSummary } from "@/components/ProfileBaselineSummary";
import { PersonalityProfileCard } from "@/components/PersonalityProfileCard";
import { ReminderSettings } from "@/components/ReminderSettings";
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
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

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

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 10) {
      setPasswordError("Password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in again to update your password.");
        setPasswordSaving(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
      setPasswordModalOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update password");
    } finally {
      setPasswordSaving(false);
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

        {/* Reminder Settings */}
        <ReminderSettings />

        {/* Security */}
        <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <button
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-accent/50 transition-colors"
              onClick={() => { setPasswordError(null); setNewPassword(""); setConfirmPassword(""); setPasswordModalOpen(true); }}
            >
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Change password</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* Change Password Modal */}
        <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Change password
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Min 10 characters"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); }}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); }}
                  autoComplete="new-password"
                />
              </div>
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setPasswordModalOpen(false)} disabled={passwordSaving}>
                Cancel
              </Button>
              <Button
                disabled={passwordSaving || !newPassword || !confirmPassword}
                onClick={handleChangePassword}
              >
                {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
