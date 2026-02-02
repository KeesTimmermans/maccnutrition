import { AppLayout } from "@/components/layout/AppLayout";

const Meals = () => {
  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold">Meals</h1>
        <p className="text-muted-foreground">
          Import Instagram recipe, Meal back-logging, Meal plan generator
        </p>
        {/* Components will be moved here in Commit 6 */}
      </div>
    </AppLayout>
  );
};

export default Meals;
