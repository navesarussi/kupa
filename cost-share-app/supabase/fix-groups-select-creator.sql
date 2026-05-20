-- Allow group creators to SELECT their own group rows even before a group_members row exists.
-- Fixes RLS failure on createGroup's RETURNING clause: is_group_member(id) is FALSE on a brand-new
-- group because the creator's group_members row hasn't been inserted yet. Two SELECT policies are OR'd.

DROP POLICY IF EXISTS "Group creators can view their groups" ON public.groups;
CREATE POLICY "Group creators can view their groups" ON public.groups
    FOR SELECT USING (auth.uid() = created_by);
