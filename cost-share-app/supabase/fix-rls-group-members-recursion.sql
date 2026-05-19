-- Fix: infinite recursion detected in policy for relation "group_members" (42P17)
-- Run in Supabase SQL Editor on an existing project (does not drop data).

CREATE OR REPLACE FUNCTION public.is_group_member(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.group_members
        WHERE group_id = check_group_id
          AND user_id = auth.uid()
          AND is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_creator(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.groups
        WHERE id = check_group_id
          AND created_by = auth.uid()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_group_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_creator(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "Users can view group members" ON group_members;
DROP POLICY IF EXISTS "Users can insert group members" ON group_members;
DROP POLICY IF EXISTS "Users can update group members" ON group_members;
DROP POLICY IF EXISTS "Users can view group expenses" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Users can update group expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view expense splits in their groups" ON expense_splits;
DROP POLICY IF EXISTS "Users can insert expense splits" ON expense_splits;
DROP POLICY IF EXISTS "Users can delete expense splits" ON expense_splits;
DROP POLICY IF EXISTS "Users can view settlements in their groups" ON settlements;
DROP POLICY IF EXISTS "Users can create settlements in their groups" ON settlements;

CREATE POLICY "Users can view their groups" ON groups
    FOR SELECT USING (public.is_group_member(id));

CREATE POLICY "Users can view group members" ON group_members
    FOR SELECT USING (
        user_id = auth.uid() OR public.is_group_member(group_id)
    );

CREATE POLICY "Users can insert group members" ON group_members
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        OR public.is_group_creator(group_id)
        OR public.is_group_member(group_id)
    );

CREATE POLICY "Users can update group members" ON group_members
    FOR UPDATE USING (public.is_group_member(group_id));

CREATE POLICY "Users can view group expenses" ON expenses
    FOR SELECT USING (public.is_group_member(group_id));

CREATE POLICY "Users can create expenses in their groups" ON expenses
    FOR INSERT WITH CHECK (public.is_group_member(group_id));

CREATE POLICY "Users can update group expenses" ON expenses
    FOR UPDATE USING (public.is_group_member(group_id));

CREATE POLICY "Users can view expense splits in their groups" ON expense_splits
    FOR SELECT USING (
        expense_id IN (
            SELECT e.id FROM expenses e
            WHERE public.is_group_member(e.group_id)
        )
    );

CREATE POLICY "Users can insert expense splits" ON expense_splits
    FOR INSERT WITH CHECK (
        expense_id IN (
            SELECT e.id FROM expenses e
            WHERE public.is_group_member(e.group_id)
        )
    );

CREATE POLICY "Users can delete expense splits" ON expense_splits
    FOR DELETE USING (
        expense_id IN (
            SELECT e.id FROM expenses e
            WHERE public.is_group_member(e.group_id)
        )
    );

CREATE POLICY "Users can view settlements in their groups" ON settlements
    FOR SELECT USING (public.is_group_member(group_id));

CREATE POLICY "Users can create settlements in their groups" ON settlements
    FOR INSERT WITH CHECK (public.is_group_member(group_id));
