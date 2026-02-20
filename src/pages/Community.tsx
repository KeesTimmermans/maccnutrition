import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Heart,
  MessageCircle,
  Flag,
  Send,
  Trophy,
  HelpCircle,
  AlertTriangle,
  Pin,
  PinOff,
  Trash2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fetchPosts,
  createPost,
  softDeletePost,
  togglePinPost,
  likePost,
  unlikePost,
  fetchComments,
  createComment,
  softDeleteComment,
  reportTarget,
  checkIsAdmin,
  type CommunityPost,
  type CommunityComment,
  type PostType,
  type ReportReason,
} from "@/lib/community/communityService";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

const POST_TYPE_CONFIG: Record<PostType, { label: string; icon: typeof Trophy; color: string }> = {
  win: { label: "Win", icon: Trophy, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  struggle: { label: "Struggle", icon: AlertTriangle, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  question: { label: "Question", icon: HelpCircle, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "medical_misinformation", label: "Medical misinformation" },
  { value: "eating_disorder", label: "Eating disorder content" },
  { value: "other", label: "Other" },
];

const FILTERS: { value: PostType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "win", label: "🏆 Wins" },
  { value: "struggle", label: "💪 Struggles" },
  { value: "question", label: "❓ Questions" },
];

const Community = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<PostType | "all">("all");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Composer state
  const [composerType, setComposerType] = useState<PostType>("win");
  const [composerContent, setComposerContent] = useState("");
  const [posting, setPosting] = useState(false);

  // Track liked posts client-side
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // Comments state
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentsMap, setCommentsMap] = useState<Record<string, CommunityComment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
    checkIsAdmin().then(setIsAdmin);
  }, []);

  const loadPosts = useCallback(async (cursor?: string) => {
    try {
      const typeFilter = filter === "all" ? undefined : filter;
      const result = await fetchPosts({ type: typeFilter, cursor, limit: 20 });
      if (cursor) {
        setPosts((prev) => [...prev, ...result.posts]);
      } else {
        setPosts(result.posts);
      }
      setNextCursor(result.nextCursor);
    } catch (err) {
      toast.error("Failed to load posts");
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    loadPosts().finally(() => setLoading(false));
  }, [loadPosts]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await loadPosts(nextCursor);
    setLoadingMore(false);
  };

  const handlePost = async () => {
    if (!composerContent.trim()) return;
    setPosting(true);
    try {
      await createPost({ type: composerType, content: composerContent.trim() });
      setComposerContent("");
      toast.success("Post shared!");
      await loadPosts();
    } catch (err) {
      toast.error("Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (postId: string, reason?: string) => {
    try {
      await softDeletePost(postId, reason);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete post");
    }
  };

  const handlePin = async (postId: string, currentlyPinned: boolean) => {
    try {
      await togglePinPost(postId, !currentlyPinned);
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_pinned: !currentlyPinned } : p));
      toast.success(currentlyPinned ? "Post unpinned" : "Post pinned");
    } catch {
      toast.error("Failed to update pin");
    }
  };

  const handleLike = async (postId: string) => {
    const isLiked = likedPosts.has(postId);
    // Optimistic update
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, like_count: p.like_count + (isLiked ? -1 : 1) }
          : p
      )
    );
    try {
      if (isLiked) await unlikePost(postId);
      else await likePost(postId);
    } catch {
      // Revert
      setLikedPosts((prev) => {
        const next = new Set(prev);
        if (isLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, like_count: p.like_count + (isLiked ? 1 : -1) }
            : p
        )
      );
    }
  };

  const toggleComments = async (postId: string) => {
    const isOpen = expandedComments.has(postId);
    if (isOpen) {
      setExpandedComments((prev) => { const s = new Set(prev); s.delete(postId); return s; });
      return;
    }
    setExpandedComments((prev) => new Set(prev).add(postId));
    if (!commentsMap[postId]) {
      setLoadingComments((prev) => new Set(prev).add(postId));
      try {
        const comments = await fetchComments(postId);
        setCommentsMap((prev) => ({ ...prev, [postId]: comments }));
      } catch {
        toast.error("Failed to load comments");
      } finally {
        setLoadingComments((prev) => { const s = new Set(prev); s.delete(postId); return s; });
      }
    }
  };

  const handleAddComment = async (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    try {
      await createComment({ postId, content });
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      const comments = await fetchComments(postId);
      setCommentsMap((prev) => ({ ...prev, [postId]: comments }));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: comments.length } : p));
    } catch {
      toast.error("Failed to add comment");
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      await softDeleteComment(commentId);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).filter((c) => c.id !== commentId),
      }));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p));
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const handleReport = async (targetType: "post" | "comment", targetId: string, reason: ReportReason) => {
    try {
      await reportTarget({ targetType, targetId, reason });
      toast.success("Report submitted. Thank you.");
    } catch {
      toast.error("Failed to submit report");
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Community</h1>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => navigate("/community/reports")} className="gap-1">
              <ShieldCheck className="w-4 h-4" /> Reports
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Composer */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              {(Object.keys(POST_TYPE_CONFIG) as PostType[]).map((t) => {
                const cfg = POST_TYPE_CONFIG[t];
                return (
                  <button
                    key={t}
                    onClick={() => setComposerType(t)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      composerType === t ? cfg.color + " ring-2 ring-primary/30" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            <Textarea
              placeholder="Share a win, struggle, or question…"
              value={composerContent}
              onChange={(e) => setComposerContent(e.target.value.slice(0, 500))}
              className="min-h-[80px] resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{composerContent.length}/500</span>
              <Button size="sm" onClick={handlePost} disabled={!composerContent.trim() || posting}>
                <Send className="w-4 h-4 mr-1" />
                {posting ? "Posting…" : "Post"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Feed */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}><CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-4 w-24" />
              </CardContent></Card>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No posts yet</p>
            <p className="text-sm">Be the first to share!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                isLiked={likedPosts.has(post.id)}
                onLike={() => handleLike(post.id)}
                onDelete={(reason) => handleDelete(post.id, reason)}
                onPin={() => handlePin(post.id, post.is_pinned)}
                onReport={(reason) => handleReport("post", post.id, reason)}
                commentsExpanded={expandedComments.has(post.id)}
                onToggleComments={() => toggleComments(post.id)}
                comments={commentsMap[post.id] ?? []}
                loadingComments={loadingComments.has(post.id)}
                commentInput={commentInputs[post.id] ?? ""}
                onCommentInputChange={(v) => setCommentInputs((prev) => ({ ...prev, [post.id]: v }))}
                onAddComment={() => handleAddComment(post.id)}
                onDeleteComment={(cId) => handleDeleteComment(post.id, cId)}
                onReportComment={(cId, reason) => handleReport("comment", cId, reason)}
              />
            ))}
            {nextCursor && (
              <Button variant="outline" className="w-full" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

/* ── Post Card ── */

interface PostCardProps {
  post: CommunityPost;
  currentUserId: string | null;
  isAdmin: boolean;
  isLiked: boolean;
  onLike: () => void;
  onDelete: (reason?: string) => void;
  onPin: () => void;
  onReport: (reason: ReportReason) => void;
  commentsExpanded: boolean;
  onToggleComments: () => void;
  comments: CommunityComment[];
  loadingComments: boolean;
  commentInput: string;
  onCommentInputChange: (v: string) => void;
  onAddComment: () => void;
  onDeleteComment: (commentId: string) => void;
  onReportComment: (commentId: string, reason: ReportReason) => void;
}

const PostCard = ({
  post,
  currentUserId,
  isAdmin,
  isLiked,
  onLike,
  onDelete,
  onPin,
  onReport,
  commentsExpanded,
  onToggleComments,
  comments,
  loadingComments,
  commentInput,
  onCommentInputChange,
  onAddComment,
  onDeleteComment,
  onReportComment,
}: PostCardProps) => {
  const cfg = POST_TYPE_CONFIG[post.type];
  const TypeIcon = cfg.icon;
  const isOwn = currentUserId === post.user_id;
  const canDelete = isOwn || isAdmin;
  const initials = (post.display_name ?? "?").slice(0, 2).toUpperCase();

  return (
    <Card className={cn(post.is_pinned && "ring-1 ring-primary/30")}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{post.display_name ?? "Anonymous"}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {post.is_pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0.5", cfg.color)}>
              <TypeIcon className="w-3 h-3 mr-0.5" />
              {cfg.label}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <p className="text-sm whitespace-pre-wrap break-words">{post.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 px-2 gap-1", isLiked && "text-red-500")}
            onClick={onLike}
          >
            <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
            <span className="text-xs">{post.like_count || ""}</span>
          </Button>

          <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" onClick={onToggleComments}>
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs">{post.comment_count || ""}</span>
            {commentsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>

          <div className="flex-1" />

          {isAdmin && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onPin} title={post.is_pinned ? "Unpin" : "Pin"}>
              {post.is_pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </Button>
          )}

          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive"
              onClick={() => {
                if (isAdmin && !isOwn) {
                  const reason = window.prompt("Reason for deletion (optional):");
                  onDelete(reason || undefined);
                } else {
                  onDelete();
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}

          <ReportMenu onReport={onReport} />
        </div>

        {/* Comments Section */}
        {commentsExpanded && (
          <div className="border-t pt-3 space-y-3">
            {loadingComments ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No comments yet</p>
            ) : (
              <div className="space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2 items-start">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className="text-[10px] bg-muted">{(c.display_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">
                        <span className="font-semibold">{c.display_name ?? "Anonymous"}</span>{" "}
                        <span className="text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                      </p>
                      <p className="text-sm break-words">{c.content}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {(currentUserId === c.user_id || isAdmin) && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => onDeleteComment(c.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                      <ReportMenu onReport={(reason) => onReportComment(c.id, reason)} small />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a comment…"
                value={commentInput}
                onChange={(e) => onCommentInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddComment()}
                className="flex-1 text-sm bg-muted rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary/30"
              />
              <Button size="sm" variant="ghost" className="h-8" onClick={onAddComment} disabled={!commentInput.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/* ── Report Dropdown ── */

const ReportMenu = ({ onReport, small }: { onReport: (reason: ReportReason) => void; small?: boolean }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className={cn(small ? "h-6 w-6 p-0" : "h-8 px-2")}>
        <Flag className={cn(small ? "w-3 h-3" : "w-4 h-4")} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="bg-popover z-50">
      {REPORT_REASONS.map((r) => (
        <DropdownMenuItem key={r.value} onClick={() => onReport(r.value)}>
          {r.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

export default Community;
