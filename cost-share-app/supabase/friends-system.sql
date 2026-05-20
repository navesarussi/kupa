-- Friends system: tables, auto-friend trigger, backfill, RLS, and RPCs.
-- Idempotent — safe to re-run. Apply via scripts/supabase-apply-patches.sh.

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('request', 'auto')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT friendships_canonical_order CHECK (user_a_id < user_b_id),
    CONSTRAINT friendships_unique_pair UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_user_a ON friendships(user_a_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON friendships(user_b_id);

CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT friend_requests_distinct CHECK (from_user_id <> to_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_pending_unique
    ON friend_requests(from_user_id, to_user_id)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friend_requests_incoming
    ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_outgoing
    ON friend_requests(from_user_id, status);

CREATE TABLE IF NOT EXISTS friend_blocks (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, blocked_user_id),
    CONSTRAINT friend_blocks_distinct CHECK (user_id <> blocked_user_id)
);

-- ============================================
-- AUTO-FRIEND TRIGGER ON group_members
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_friend_on_group_member_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.is_active IS DISTINCT FROM TRUE THEN
        RETURN NEW;
    END IF;

    INSERT INTO friendships (user_a_id, user_b_id, source)
    SELECT
        LEAST(NEW.user_id, gm.user_id)    AS user_a_id,
        GREATEST(NEW.user_id, gm.user_id) AS user_b_id,
        'auto'                            AS source
    FROM group_members gm
    WHERE gm.group_id = NEW.group_id
      AND gm.is_active = TRUE
      AND gm.user_id <> NEW.user_id
      AND NOT EXISTS (
          SELECT 1 FROM friend_blocks fb
          WHERE (fb.user_id = NEW.user_id AND fb.blocked_user_id = gm.user_id)
             OR (fb.user_id = gm.user_id AND fb.blocked_user_id = NEW.user_id)
      )
    ON CONFLICT (user_a_id, user_b_id) DO NOTHING;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_friend_on_group_member_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_group_member_insert_auto_friend ON group_members;
CREATE TRIGGER on_group_member_insert_auto_friend
    AFTER INSERT ON group_members
    FOR EACH ROW EXECUTE FUNCTION public.auto_friend_on_group_member_insert();

-- Re-activation (is_active flipping from false back to true) should also auto-friend.
CREATE OR REPLACE FUNCTION public.auto_friend_on_group_member_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.is_active = TRUE AND (OLD.is_active IS NULL OR OLD.is_active = FALSE) THEN
        INSERT INTO friendships (user_a_id, user_b_id, source)
        SELECT
            LEAST(NEW.user_id, gm.user_id),
            GREATEST(NEW.user_id, gm.user_id),
            'auto'
        FROM group_members gm
        WHERE gm.group_id = NEW.group_id
          AND gm.is_active = TRUE
          AND gm.user_id <> NEW.user_id
          AND NOT EXISTS (
              SELECT 1 FROM friend_blocks fb
              WHERE (fb.user_id = NEW.user_id AND fb.blocked_user_id = gm.user_id)
                 OR (fb.user_id = gm.user_id AND fb.blocked_user_id = NEW.user_id)
          )
        ON CONFLICT (user_a_id, user_b_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_friend_on_group_member_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_group_member_update_auto_friend ON group_members;
CREATE TRIGGER on_group_member_update_auto_friend
    AFTER UPDATE OF is_active ON group_members
    FOR EACH ROW EXECUTE FUNCTION public.auto_friend_on_group_member_update();

-- ============================================
-- BACKFILL — existing shared-group pairs become friends
-- ============================================

INSERT INTO friendships (user_a_id, user_b_id, source)
SELECT DISTINCT
    LEAST(a.user_id, b.user_id)    AS user_a_id,
    GREATEST(a.user_id, b.user_id) AS user_b_id,
    'auto'                          AS source
FROM group_members a
JOIN group_members b
    ON a.group_id = b.group_id
   AND a.user_id < b.user_id
WHERE a.is_active = TRUE
  AND b.is_active = TRUE
ON CONFLICT (user_a_id, user_b_id) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE friendships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_blocks    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their friendships" ON friendships;
CREATE POLICY "Users can view their friendships" ON friendships
    FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "Users can view their friend requests" ON friend_requests;
CREATE POLICY "Users can view their friend requests" ON friend_requests
    FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "Users can view their blocks" ON friend_blocks;
CREATE POLICY "Users can view their blocks" ON friend_blocks
    FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies on purpose — all writes go through SECURITY DEFINER RPCs.

-- ============================================
-- RPC: send_friend_request
-- ============================================

CREATE OR REPLACE FUNCTION public.send_friend_request(p_to_user_id UUID)
RETURNS friend_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_a UUID;
    v_b UUID;
    v_row friend_requests;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
    END IF;
    IF p_to_user_id IS NULL OR p_to_user_id = v_me THEN
        RAISE EXCEPTION 'invalid_target' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_to_user_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'recipient_not_found' USING ERRCODE = '22023';
    END IF;

    v_a := LEAST(v_me, p_to_user_id);
    v_b := GREATEST(v_me, p_to_user_id);

    IF EXISTS (SELECT 1 FROM friendships WHERE user_a_id = v_a AND user_b_id = v_b) THEN
        RAISE EXCEPTION 'already_friends' USING ERRCODE = '23505';
    END IF;

    IF EXISTS (
        SELECT 1 FROM friend_requests
        WHERE status = 'pending'
          AND ((from_user_id = v_me AND to_user_id = p_to_user_id)
            OR (from_user_id = p_to_user_id AND to_user_id = v_me))
    ) THEN
        RAISE EXCEPTION 'request_already_pending' USING ERRCODE = '23505';
    END IF;

    INSERT INTO friend_requests (from_user_id, to_user_id, status)
    VALUES (v_me, p_to_user_id, 'pending')
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_friend_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated;

-- ============================================
-- RPC: accept_friend_request
-- ============================================

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id UUID)
RETURNS friendships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_req friend_requests;
    v_a UUID;
    v_b UUID;
    v_friendship friendships;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT * INTO v_req FROM friend_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'request_not_found' USING ERRCODE = '22023';
    END IF;
    IF v_req.to_user_id <> v_me THEN
        RAISE EXCEPTION 'not_recipient' USING ERRCODE = '42501';
    END IF;
    IF v_req.status <> 'pending' THEN
        RAISE EXCEPTION 'request_not_pending' USING ERRCODE = '22023';
    END IF;

    UPDATE friend_requests
        SET status = 'accepted', responded_at = NOW()
        WHERE id = p_request_id;

    -- Re-friending wipes any prior manual-removal record in either direction.
    DELETE FROM friend_blocks
        WHERE (user_id = v_req.from_user_id AND blocked_user_id = v_req.to_user_id)
           OR (user_id = v_req.to_user_id AND blocked_user_id = v_req.from_user_id);

    v_a := LEAST(v_req.from_user_id, v_req.to_user_id);
    v_b := GREATEST(v_req.from_user_id, v_req.to_user_id);

    INSERT INTO friendships (user_a_id, user_b_id, source)
    VALUES (v_a, v_b, 'request')
    ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET source = friendships.source
    RETURNING * INTO v_friendship;

    RETURN v_friendship;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_friend_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(UUID) TO authenticated;

-- ============================================
-- RPC: reject_friend_request
-- ============================================

CREATE OR REPLACE FUNCTION public.reject_friend_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_req friend_requests;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT * INTO v_req FROM friend_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'request_not_found' USING ERRCODE = '22023';
    END IF;
    IF v_req.to_user_id <> v_me THEN
        RAISE EXCEPTION 'not_recipient' USING ERRCODE = '42501';
    END IF;
    IF v_req.status <> 'pending' THEN
        RAISE EXCEPTION 'request_not_pending' USING ERRCODE = '22023';
    END IF;

    UPDATE friend_requests
        SET status = 'rejected', responded_at = NOW()
        WHERE id = p_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_friend_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_friend_request(UUID) TO authenticated;

-- ============================================
-- RPC: remove_friend
-- ============================================

CREATE OR REPLACE FUNCTION public.remove_friend(p_other_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_a UUID;
    v_b UUID;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
    END IF;
    IF p_other_user_id IS NULL OR p_other_user_id = v_me THEN
        RAISE EXCEPTION 'invalid_target' USING ERRCODE = '22023';
    END IF;

    v_a := LEAST(v_me, p_other_user_id);
    v_b := GREATEST(v_me, p_other_user_id);

    DELETE FROM friendships WHERE user_a_id = v_a AND user_b_id = v_b;

    INSERT INTO friend_blocks (user_id, blocked_user_id)
    VALUES (v_me, p_other_user_id)
    ON CONFLICT (user_id, blocked_user_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_friend(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO authenticated;

-- ============================================
-- RPC: search_users — match name/email/phone, attach relationship state
-- ============================================

CREATE OR REPLACE FUNCTION public.search_users(p_query TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    relationship TEXT,
    request_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_q  TEXT;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
    END IF;

    v_q := BTRIM(COALESCE(p_query, ''));
    IF char_length(v_q) < 2 THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH matches AS (
        SELECT p.id, p.name, p.email, p.phone, p.avatar_url
        FROM profiles p
        WHERE p.is_active = TRUE
          AND (
              p.name  ILIKE '%' || v_q || '%'
              OR p.email ILIKE '%' || v_q || '%'
              OR p.phone LIKE  '%' || v_q || '%'
          )
        LIMIT 50
    )
    SELECT
        m.id,
        m.name::TEXT,
        m.email::TEXT,
        m.phone::TEXT,
        m.avatar_url,
        CASE
            WHEN m.id = v_me THEN 'self'
            WHEN EXISTS (
                SELECT 1 FROM friendships f
                WHERE f.user_a_id = LEAST(v_me, m.id)
                  AND f.user_b_id = GREATEST(v_me, m.id)
            ) THEN 'friends'
            WHEN EXISTS (
                SELECT 1 FROM friend_requests fr
                WHERE fr.status = 'pending'
                  AND fr.from_user_id = v_me AND fr.to_user_id = m.id
            ) THEN 'request_sent'
            WHEN EXISTS (
                SELECT 1 FROM friend_requests fr
                WHERE fr.status = 'pending'
                  AND fr.from_user_id = m.id AND fr.to_user_id = v_me
            ) THEN 'request_received'
            ELSE 'none'
        END AS relationship,
        (
            SELECT fr.id FROM friend_requests fr
            WHERE fr.status = 'pending'
              AND ((fr.from_user_id = v_me AND fr.to_user_id = m.id)
                OR (fr.from_user_id = m.id AND fr.to_user_id = v_me))
            LIMIT 1
        ) AS request_id
    FROM matches m;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_users(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users(TEXT) TO authenticated;
