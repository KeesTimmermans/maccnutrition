DROP POLICY IF EXISTS "Authenticated can read likes" ON public.community_likes;
CREATE POLICY "Users can read own likes" ON public.community_likes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_post_like_counts(p_post_ids uuid[])
RETURNS TABLE(post_id uuid, like_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.post_id, count(*)::bigint
  FROM public.community_likes l
  WHERE auth.uid() IS NOT NULL AND l.post_id = ANY(p_post_ids)
  GROUP BY l.post_id
$$;
REVOKE ALL ON FUNCTION public.get_post_like_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_post_like_counts(uuid[]) TO authenticated;