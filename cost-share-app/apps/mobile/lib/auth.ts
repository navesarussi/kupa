import { supabase } from './supabase';

/** Returns the signed-in Supabase user id, or null if not authenticated. */
export async function getCurrentUserId(): Promise<string | null> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
}
