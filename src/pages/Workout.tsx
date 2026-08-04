import { Dumbbell } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

const Workout = () => {
  return (
    <AppLayout>
      <div className="p-4">
        <div className="bg-card rounded-3xl shadow-medium p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Dumbbell className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">Workout</h1>
          <p className="text-sm text-muted-foreground">Workout tracking is coming soon</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Workout;
