import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShieldCheck, Eye, Gavel } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  checkIsAdmin,
  fetchReports,
  updateReportStatus,
  type CommunityReport,
  type ReportStatus,
} from "@/lib/community/communityService";

const STATUS_BADGE: Record<ReportStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-destructive/10 text-destructive" },
  reviewed: { label: "Reviewed", className: "bg-amber-100 text-amber-700" },
  actioned: { label: "Actioned", className: "bg-green-100 text-green-700" },
};

const CommunityReports = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportStatus | "all">("open");

  useEffect(() => {
    checkIsAdmin().then((admin) => {
      setIsAdmin(admin);
      if (!admin) setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isAdmin !== true) return;
    setLoading(true);
    const statusFilter = filter === "all" ? undefined : filter;
    fetchReports(statusFilter)
      .then(setReports)
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => setLoading(false));
  }, [isAdmin, filter]);

  const handleStatusChange = async (reportId: string, status: ReportStatus) => {
    try {
      await updateReportStatus(reportId, status);
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
      toast.success(`Report marked as ${status}`);
    } catch {
      toast.error("Failed to update report");
    }
  };

  if (isAdmin === false) {
    return (
      <AppLayout>
        <div className="p-4 text-center py-20">
          <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="font-semibold text-lg">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-1">This page is for administrators only.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/community")}>
            Back to Community
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/community")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Community Reports</h1>
        </div>

        {/* Status filter */}
        <div className="flex gap-2">
          {(["all", "open", "reviewed", "actioned"] as const).map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No reports</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const badge = STATUS_BADGE[r.status];
              return (
                <Card key={r.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge variant="secondary" className="text-[10px]">
                          {r.target_type}
                        </Badge>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <Badge className={badge.className + " text-[10px]"}>{badge.label}</Badge>
                    </div>
                    <p className="text-sm font-medium capitalize">{r.reason.replace(/_/g, " ")}</p>
                    {r.details && <p className="text-xs text-muted-foreground">{r.details}</p>}
                    <p className="text-[10px] text-muted-foreground font-mono truncate">Target: {r.target_id}</p>

                    {r.status !== "actioned" && (
                      <div className="flex gap-2 pt-1">
                        {r.status === "open" && (
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => handleStatusChange(r.id, "reviewed")}>
                            <Eye className="w-3 h-3" /> Reviewed
                          </Button>
                        )}
                        <Button size="sm" variant="default" className="gap-1" onClick={() => handleStatusChange(r.id, "actioned")}>
                          <Gavel className="w-3 h-3" /> Actioned
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CommunityReports;
