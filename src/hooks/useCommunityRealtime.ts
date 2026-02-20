import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CommunityPost, CommunityComment } from "@/lib/community/communityService";
import { fetchComments } from "@/lib/community/communityService";

interface UseCommunityRealtimeParams {
  onNewPost: (post: { id: string; user_id: string; type: string; content: string; created_at: string; is_pinned: boolean }) => void;
  onPostUpdated: (post: { id: string; is_pinned?: boolean; is_deleted?: boolean }) => void;
  onLikeChange: (postId: string, delta: number) => void;
  onCommentChange: (postId: string) => void;
}

export function useCommunityRealtime({
  onNewPost,
  onPostUpdated,
  onLikeChange,
  onCommentChange,
}: UseCommunityRealtimeParams) {
  useEffect(() => {
    const channel = supabase
      .channel("community-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_posts" },
        (payload) => {
          const p = payload.new as any;
          if (!p.is_deleted) {
            onNewPost({
              id: p.id,
              user_id: p.user_id,
              type: p.type,
              content: p.content,
              created_at: p.created_at,
              is_pinned: p.is_pinned ?? false,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "community_posts" },
        (payload) => {
          const p = payload.new as any;
          onPostUpdated({ id: p.id, is_pinned: p.is_pinned, is_deleted: p.is_deleted });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_likes" },
        (payload) => {
          const l = payload.new as any;
          onLikeChange(l.post_id, 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "community_likes" },
        (payload) => {
          const l = payload.old as any;
          onLikeChange(l.post_id, -1);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_comments" },
        (payload) => {
          const c = payload.new as any;
          if (!c.is_deleted) {
            onCommentChange(c.post_id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "community_comments" },
        (payload) => {
          const c = payload.new as any;
          onCommentChange(c.post_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewPost, onPostUpdated, onLikeChange, onCommentChange]);
}
