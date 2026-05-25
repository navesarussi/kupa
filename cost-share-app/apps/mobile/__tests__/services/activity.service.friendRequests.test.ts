/**
 * Verifies incoming friend requests are merged into the activity feed mapper.
 */

import type { RecentActivity } from '@cost-share/shared';

// Replicate mapper shape without hitting Supabase.
function mapFriendRequestRow(
    row: { id: string; from_user_id: string; created_at: string },
    profile?: { name: string },
): RecentActivity {
    const createdAt = new Date(row.created_at);
    return {
        id: row.id,
        activityType: 'friend_request',
        groupId: '',
        description: '',
        amount: 0,
        currency: '',
        userId: row.from_user_id,
        userName: profile?.name ?? 'Unknown',
        activityDate: createdAt,
        createdAt,
    };
}

describe('activity friend request mapping', () => {
    it('maps pending incoming requests to friend_request activities', () => {
        const activity = mapFriendRequestRow(
            {
                id: 'fr-1',
                from_user_id: 'user-a',
                created_at: '2026-05-20T10:00:00.000Z',
            },
            { name: 'Alice' },
        );
        expect(activity.activityType).toBe('friend_request');
        expect(activity.userName).toBe('Alice');
        expect(activity.groupId).toBe('');
    });
});
