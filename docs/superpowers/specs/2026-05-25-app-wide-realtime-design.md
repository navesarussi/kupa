# App-Wide Realtime — Design

**Date:** 2026-05-25
**Status:** Draft
**Scope:** Mobile app (`cost-share-app/apps/mobile`)

## Problem

Expenses, settlements, and group messages update live on the open Group screen. But many other changes do not:

- Editing a group name / image / description / type / default currency on device A does **not** propagate to device B.
- Friend requests, friend additions/removals, archive toggles do not propagate to other devices of the same user.

The user-facing requirement: **every shared piece of state should feel live across all devices, all the time** — not just when a specific screen happens to be open.

## Goal

A single, efficient realtime layer that keeps user-level data fresh app-wide while reusing the existing per-screen subscriptions for high-volume per-group data.

## Architecture

Two tiers of realtime subscriptions:

### Tier 1 — App-level (one channel per user)

A single Supabase channel `app:user:<userId>` mounted once at app root via a new hook **`useAppRealtime(userId)`**. The channel carries five `postgres_changes` listeners for data that the user must see updated regardless of which screen is open:

| # | Table | Filter | Reason |
|---|---|---|---|
| 1 | `groups` | none (RLS scopes to user's groups) | Group name / image / type / default_currency / description / note changes |
| 2 | `group_members` | `user_id=eq.<userId>` | User joined / removed / re-activated in a group |
| 3 | `friendships` | none (RLS scopes) | Friend added / removed |
| 4 | `friend_requests` | none (RLS scopes) | Incoming / outgoing friend request lifecycle |
| 5 | `group_user_archive` | `user_id=eq.<userId>` | Multi-device archive state sync |

Mounting point: top-level inside the authenticated branch of `App.tsx` (replaces the current `useUserGroupMembershipsRealtime` call in `GroupsListScreen`). Lifecycle is tied to `userId`: created on sign-in, torn down on sign-out / user switch.

### Tier 2 — Per-screen channels (unchanged)

These remain exactly as they are today — they are high-volume per-group streams and only worth subscribing to while the user is viewing that group:

- `useGroupExpensesRealtime(groupId)` — Group detail
- `useGroupSettlementsRealtime(groupId)` — Group detail, Settle Up list
- `useGroupMessagesRealtime(groupId)` — Group detail

## Per-listener behavior

### 1. `groups`

- **UPDATE** with `is_active=false`: drop the group from store (`removeGroup`).
- **UPDATE** with `is_active=true`:
  - If the row already exists in the store, patch it in place (preserve `members`, `isArchivedByMe`, `isAutoArchived` — same merge as `updateGroup` in `groups.service.ts`).
  - If it does not exist (edge case: just joined, listener #2 will also fire), ignore; listener #2 will refetch.
- **DELETE**: `removeGroup(id)`.
- **INSERT**: ignore. New groups appear via listener #2 (membership), which then refetches the full list.

Side effect on every group update: no balance/derived cache invalidation needed — group metadata doesn't affect balances.

### 2. `group_members` (replaces `useUserGroupMembershipsRealtime`)

Same behavior as the current hook — kept verbatim, just moved into `useAppRealtime`:

- INSERT / UPDATE→is_active=true: `fetchGroups()` + `fetchBalanceSummary()` + invalidate `queryKeys.dashboard`.
- UPDATE→is_active=false: `removeGroup(groupId)`.
- DELETE: `removeGroup(groupId)`.

### 3. `friendships`

Any event: invalidate `useFriendsQueries` keys (friends list). No store mutation — friends are React Query-owned. Also invalidate `queryKeys.dashboard` if it shows friend balances.

### 4. `friend_requests`

Any event: invalidate the incoming and outgoing requests queries. On INSERT where `to_user_id === currentUserId`, optionally surface a toast (`i18n.t('friends.newRequest')`); decide during implementation based on whether the friends screens already show a badge.

### 5. `group_user_archive`

The table is existence-based: a row exists for `(user_id, group_id)` iff the user has archived that group (no `is_archived` column; columns are `user_id, group_id, archived_at`).

- **INSERT**: `useAppStore.updateGroup({ ...existing, isArchivedByMe: true })` for `payload.new.group_id`.
- **DELETE**: `useAppStore.updateGroup({ ...existing, isArchivedByMe: false })` for `payload.old.group_id`.
- UPDATE: not expected; ignore.

## Reconnection / snapshot-on-resume

Realtime can miss events when:
- The device is backgrounded long enough that the socket drops.
- Network drops mid-session.

To stay correct on reconnect, `useAppRealtime` registers the channel's `SUBSCRIBED` callback and on each successful (re)subscribe runs a one-shot snapshot refetch:

1. `fetchGroups()`
2. `fetchBalanceSummary()`
3. React Query invalidate: dashboard, friends, friend requests.

This guarantees that any events missed while disconnected are reconciled within ~1s of reconnect.

## Files affected

- **New:** `cost-share-app/apps/mobile/hooks/useAppRealtime.ts`
- **Modified:** `cost-share-app/apps/mobile/App.tsx` — mount `useAppRealtime(userId)` after auth.
- **Modified:** `cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx` — remove `useUserGroupMembershipsRealtime` call (now app-level).
- **Deleted:** `cost-share-app/apps/mobile/hooks/useUserGroupMembershipsRealtime.ts` — logic absorbed into `useAppRealtime`.

No DB / migration changes required — all five tables are either already in the `supabase_realtime` publication (`groups`, `group_members`) or need to be added:

- `friendships`, `friend_requests`, `group_user_archive` — **add to publication** via a new idempotent migration `cost-share-app/supabase/realtime-friends-archive.sql`.

## RLS check

For each of the three tables to be added to the publication, realtime delivers an event only if the receiver passes the table's SELECT policy on the new row:

- `friendships`: policy `"Users can view their friendships"` — restricts to user_id_a / user_id_b. ✓ receiver-scoped.
- `friend_requests`: policy `"Users can view their friend requests"` — restricts to from / to. ✓ receiver-scoped.
- `group_user_archive`: policy `"Users can view their own archive rows"` already restricts SELECT to `auth.uid() = user_id`. ✓ receiver-scoped.

## Out of scope

- **`profiles`** (name / avatar of friends and group members). Adding it to realtime would broadcast every profile change to every user (RLS for profiles is `"viewable by everyone"`). Instead, refetch profile data on screen focus where it is rendered. A future tightening of the profiles SELECT policy + adding to the publication can revisit this.
- **`expense_splits`** — already covered indirectly by the existing `expenses` UPDATE refetch.
- **Web app** — currently marketing/auth only, no group features.

## Success criteria

- Editing the group name / image on device A appears on device B within ~1s, whether device B is on Group Detail, Groups List, Dashboard, or any other screen — verified by manual two-device test.
- New incoming friend request appears in the friend requests list within ~1s without a manual reload.
- Archiving a group on device A reflects on device B within ~1s.
- No more than one Supabase realtime channel is open per authenticated user for app-level data (verifiable via Supabase dashboard → Realtime inspector).
- Existing per-group screens continue to work exactly as before (no regressions in expenses/settlements/messages live updates).

## Testing plan

- **Manual two-device test:**
  1. Edit group name on phone A → phone B Groups List + Group Detail both reflect immediately.
  2. Edit group image on phone A → phone B reflects immediately.
  3. Send friend request from phone A → phone B sees it in incoming list without reload.
  4. Accept request on phone B → both devices show friend in friends list.
  5. Archive group on phone A → phone B (same user) moves group to archived state.
- **Reconnect test:** put phone B in airplane mode, do above edits on phone A, restore phone B's connection → phone B reconciles within ~2s.
- **No-regression test:** verify the existing live behavior for expenses, settlements, messages on the open Group Detail screen still works.
