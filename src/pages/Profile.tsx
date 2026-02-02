import { AppLayout } from "@/components/layout/AppLayout";
import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Profile = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Profile</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-muted-foreground">
          User info, Profile summary, Baseline breakdown
        </p>
        {/* Components will be moved here in Commit 8 */}
      </div>
    </AppLayout>
  );
};

export default Profile;
