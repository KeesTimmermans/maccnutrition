import { supabase } from "@/integrations/supabase/client";

export type PostType = "win" | "struggle" | "question";
export type ReportReason = "spam" | "harassment" | "medical_misinformation" | "eating_disorder" | "other";
export type ReportStatus = "open" | "reviewed" | "actioned";

export interface CommunityReport {
  id: string;
  reporter_user_id: string;
  target_type: "post" | "comment";
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}

export async function checkIsAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  type: PostType;
  content: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  display_name: string | null;
  avatar_url: string | null;
  like_count: number;
  comment_count: number;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface FetchPostsParams {
  type?: PostType;
  limit?: number;
  cursor?: string;
}

export async function fetchPosts({ type, limit = 20, cursor }: FetchPostsParams = {}): Promise<{ posts: CommunityPost[]; nextCursor: string | null }> {
  let query = supabase
    .from("community_posts")
    .select("id, user_id, type, content, created_at, updated_at, is_pinned")
    .eq("is_deleted", false)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (type) query = query.eq("type", type);
  if (cursor) query = query.lt("created_at", cursor);

  const { data: posts, error } = await query;
  if (error) throw new Error(`Failed to fetch posts: ${error.message}`);
  if (!posts || posts.length === 0) return { posts: [], nextCursor: null };

  const hasMore = posts.length > limit;
  const sliced = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? sliced[sliced.length - 1].created_at : null;

  const userIds = [...new Set(sliced.map((p) => p.user_id))];
  const postIds = sliced.map((p) => p.id);

  const [profilesRes, likesRes, commentsRes] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds),
    supabase.from("community_likes").select("post_id").in("post_id", postIds),
    supabase.from("community_comments").select("post_id").eq("is_deleted", false).in("post_id", postIds),
  ]);

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));

  const likeCounts = new Map<string, number>();
  for (const l of likesRes.data ?? []) {
    likeCounts.set(l.post_id, (likeCounts.get(l.post_id) ?? 0) + 1);
  }

  const commentCounts = new Map<string, number>();
  for (const c of commentsRes.data ?? []) {
    commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);
  }

  const enriched: CommunityPost[] = sliced.map((p) => {
    const profile = profileMap.get(p.user_id);
    return {
      ...p,
      type: p.type as PostType,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      like_count: likeCounts.get(p.id) ?? 0,
      comment_count: commentCounts.get(p.id) ?? 0,
    };
  });

  return { posts: enriched, nextCursor };
}

export async function createPost({ type, content }: { type: PostType; content: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("community_posts")
    .insert({ user_id: user.id, type, content })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create post: ${error.message}`);
  return data;
}

export async function softDeletePost(postId: string, deletedReason?: string) {
  const update: Record<string, unknown> = { is_deleted: true };
  if (deletedReason) update.deleted_reason = deletedReason;
  const { error } = await supabase
    .from("community_posts")
    .update(update)
    .eq("id", postId);
  if (error) throw new Error(`Failed to delete post: ${error.message}`);
}

export async function togglePinPost(postId: string, isPinned: boolean) {
  const { error } = await supabase
    .from("community_posts")
    .update({ is_pinned: isPinned })
    .eq("id", postId);
  if (error) throw new Error(`Failed to pin/unpin post: ${error.message}`);
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const { data: comments, error } = await supabase
    .from("community_comments")
    .select("id, post_id, user_id, content, created_at")
    .eq("post_id", postId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to fetch comments: ${error.message}`);
  if (!comments || comments.length === 0) return [];

  const userIds = [...new Set(comments.map((c) => c.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return comments.map((c) => {
    const profile = profileMap.get(c.user_id);
    return { ...c, display_name: profile?.display_name ?? null, avatar_url: profile?.avatar_url ?? null };
  });
}

export async function createComment({ postId, content }: { postId: string; content: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("community_comments")
    .insert({ post_id: postId, user_id: user.id, content })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create comment: ${error.message}`);
  return data;
}

export async function softDeleteComment(commentId: string) {
  const { error } = await supabase
    .from("community_comments")
    .update({ is_deleted: true })
    .eq("id", commentId);
  if (error) throw new Error(`Failed to delete comment: ${error.message}`);
}

export async function likePost(postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("community_likes")
    .insert({ post_id: postId, user_id: user.id });
  if (error && error.code !== "23505") throw new Error(`Failed to like post: ${error.message}`);
}

export async function unlikePost(postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("community_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to unlike post: ${error.message}`);
}

export async function reportTarget({ targetType, targetId, reason, details }: { targetType: "post" | "comment"; targetId: string; reason: ReportReason; details?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("community_reports")
    .insert({ reporter_user_id: user.id, target_type: targetType, target_id: targetId, reason, details: details ?? null });
  if (error) throw new Error(`Failed to submit report: ${error.message}`);
}

export async function fetchReports(status?: ReportStatus): Promise<CommunityReport[]> {
  let query = supabase
    .from("community_reports")
    .select("id, reporter_user_id, target_type, target_id, reason, details, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch reports: ${error.message}`);
  return (data ?? []) as CommunityReport[];
}

export async function updateReportStatus(reportId: string, status: ReportStatus) {
  const { error } = await supabase
    .from("community_reports")
    .update({ status })
    .eq("id", reportId);
  if (error) throw new Error(`Failed to update report: ${error.message}`);
}
