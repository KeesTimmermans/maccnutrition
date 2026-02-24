import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, Search, Shield, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  name: string | null;
  primary_goal: string | null;
  target_calories: number | null;
  weight: number | null;
  unit_system: string | null;
  onboarded_at: string | null;
  subscription: {
    status: string;
    current_period_end?: string;
    trial_end?: string | null;
    plan?: string | null;
  };
}

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    const checkAdmin = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!data) {
        navigate("/");
        return;
      }
      setIsAdmin(true);
      fetchUsers();
    };

    checkAdmin();
  }, [user, authLoading]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users");
      if (error) throw error;
      setUsers(data.users ?? []);
    } catch (err: any) {
      toast({
        title: "Error loading users",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDeleteUser = async (targetUserId: string, email: string) => {
    setDeleting(targetUserId);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { target_user_id: targetUserId },
      });
      if (error) throw error;
      toast({ title: "Account deleted", description: `${email} has been permanently deleted.` });
      setUsers((prev) => prev.filter((u) => u.id !== targetUserId));
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.email?.toLowerCase().includes(q)) ||
      (u.name?.toLowerCase().includes(q))
    );
  });

  const subBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-primary text-primary-foreground">Active</Badge>;
      case "trialing":
        return <Badge className="bg-accent text-accent-foreground">Trial</Badge>;
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  if (authLoading || !isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 pb-24 max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Users" value={users.length} />
          <StatCard label="Subscribed" value={users.filter((u) => u.subscription.status === "active").length} />
          <StatCard label="Trialing" value={users.filter((u) => u.subscription.status === "trialing").length} />
          <StatCard label="Onboarded" value={users.filter((u) => u.onboarded_at).length} />
        </div>

        {/* Search + Refresh */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Calories</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{subBadge(u.subscription.status)}</TableCell>
                    <TableCell className="text-sm capitalize">{u.primary_goal?.replace(/_/g, " ") || "—"}</TableCell>
                    <TableCell className="text-sm">{u.target_calories ? `${u.target_calories} kcal` : "—"}</TableCell>
                    <TableCell className="text-sm">{format(new Date(u.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-sm">
                      {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "dd MMM yyyy") : "Never"}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={deleting === u.id}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete account permanently?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete <strong>{u.email}</strong>, cancel their Stripe subscriptions, and remove all their data. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteUser(u.id, u.email)}
                            >
                              Delete permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
};

const StatCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border bg-card p-4">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

export default AdminDashboard;
