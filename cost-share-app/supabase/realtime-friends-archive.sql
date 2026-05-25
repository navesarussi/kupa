-- Realtime: publish friendships, friend_requests, and group_user_archive so
-- the mobile client can subscribe to live INSERT/UPDATE/DELETE for the
-- current user's friend graph and per-device archive state.
--
-- RLS already restricts SELECT on all three tables to the owner(s) of the
-- row (auth.uid() matches a column on the row), so realtime delivery is
-- automatically scoped per user.
--
-- Idempotent: safe to re-run.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'friendships'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'friend_requests'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'group_user_archive'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_user_archive';
    END IF;
END $$;
