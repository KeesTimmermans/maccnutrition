import { AppLayout } from "@/components/layout/AppLayout";

const Today = () => {
  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-muted-foreground">
          Morning check-in, Coach Mac, Log a meal, Today's meals, Today's progress, Water tracking
        </p>
        {/* Components will be moved here in Commit 4 */}
      </div>
    </AppLayout>
  );
};

export default Today;
