import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Settings = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
            aria-label="Back to Profile"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Units, Currency, Dashboard layout, Language, Coaching tone, Subscription
        </p>
        {/* Settings content will be moved here in Commit 8 */}
      </div>
    </AppLayout>
  );
};

export default Settings;
