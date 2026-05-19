-- Fix: permission denied for function is_group_member (42501) on anon / preflight probes
-- RLS policies call these helpers; anon must be able to execute them (auth.uid() null → false).
-- Run in Supabase SQL Editor on an existing project (does not drop data).

REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_group_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_creator(uuid) TO anon, authenticated;
