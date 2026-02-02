import { AppLayout } from "@/components/layout/AppLayout";

const Metrics = () => {
  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold">Metrics</h1>
        <p className="text-muted-foreground">
          Body measurements, Progress photos, Wearable connections
        </p>
        {/* Components will be moved here in Commit 7 */}
      </div>
    </AppLayout>
  );
};

export default Metrics;
