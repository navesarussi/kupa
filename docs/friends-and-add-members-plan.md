# Friends System + Add Members — Implementation Plan

Status: **planned, not started**
Branch: `fix-groups`

## Goal

Two user-facing additions:

1. On a group's detail screen, when the group is empty (no expenses and no messages), show a big **"+ Add Members"** button next to the existing "Add expense" CTA.
2. On the **Edit Group** screen, add a new **Members** section with a horizontal row of member avatars and a circular **"+"** tile to add more.

Both buttons open the same modal (`AddMembersSheet`) that lets the user pick from their **friends** (minus the people already in this group) and add them.

The picker is restricted to friends, so this feature requires a **friends system** that the app does not yet have. The friends system is built first; the Add Members popup is the final, small piece that consumes it.

---

## Architecture

**Backend is Supabase only.** No Node/Express server. All logic lives in:

- Postgres tables, triggers, and RLS policies
- `SECURITY DEFINER` RPC functions called from the mobile app via `supabase-js`

Mobile is React Native / Expo (v55 — consult the v55 docs before writing any Expo-specific code, per `apps/mobile/AGENTS.md`).

---

## Decisions locked with the user

| Topic | Decision |
|---|---|
| Empty-state CTA | Keep existing "Add expense" CTA and **show both** buttons (Add expense + Add Members). |
| Picker source | **Friends only.** A real friends system must exist first. |
| Friendship model | **Mutual request/accept** AND **auto-friend on shared group**. |
| Group creation auto-friends? | **Yes** — adding people during `CreateGroup` auto-friends them. Restriction to friends-only applies only to post-creation Add Members. |
| Discovery | Search profiles by **name OR email OR phone**. |
| Friend operations | See incoming requests with Accept/Reject. Remove a friend (hidden — long-press a friend row). No block, no cancel-outgoing in v1. |
| Friends UI entry point | **Profile screen** — Friends row with a count badge for pending incoming requests. |
| Remove vs shared group | Allow remove; **do NOT auto-re-friend** while they share a group. Requires a "manually removed" record so the auto-friend trigger skips this pair. |
| FindFriends search results | **Show all matches** with per-row state (`Send request` / `Pending` / `Already friends` / nothing if it's the current user). |
| Picker style | Centered modal card, matching `MessageComposerSheet.tsx` pattern. |
| Selection mode | **Multi-select** with a single "Add" confirm button (reuses existing `MemberSelector`). |
| Post-add behavior | Close popup, refetch group, stay on detail screen. |
| Edit Group layout | New **Members section** between the form and the Danger Zone — horizontal avatars + "+" tile. "+" opens `AddMembersSheet`; tap "See all" or an avatar pushes the existing `GroupMembersScreen`. |
| Empty-friends state inside the popup | Empty-state message + a **"Find friends"** button that opens `FindFriendsScreen`. |

---

## Database design

### New tables

#### `friendships`
One row per friend pair, stored canonically (smaller UUID first) so each pair is unique.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_a_id` | UUID NOT NULL | FK `profiles(id)`, smaller of the two UUIDs |
| `user_b_id` | UUID NOT NULL | FK `profiles(id)`, larger of the two UUIDs |
| `source` | TEXT NOT NULL | `'request'` or `'auto'` |
| `created_at` | TIMESTAMPTZ default `now()` | |

Constraints:
- `UNIQUE (user_a_id, user_b_id)`
- `CHECK (user_a_id < user_b_id)`
- Indexes on each user column for "list my friends" lookups.

#### `friend_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `from_user_id` | UUID NOT NULL | FK `profiles(id)` |
| `to_user_id` | UUID NOT NULL | FK `profiles(id)` |
| `status` | TEXT NOT NULL | `'pending'` \| `'accepted'` \| `'rejected'` \| `'cancelled'` |
| `created_at` | TIMESTAMPTZ default `now()` | |
| `responded_at` | TIMESTAMPTZ NULL | set on accept/reject/cancel |

Constraints:
- `CHECK (from_user_id <> to_user_id)`
- **Partial unique index** on `(from_user_id, to_user_id) WHERE status = 'pending'` — prevents duplicate active requests in the same direction.
- Indexes on `to_user_id, status` for "my incoming pending" lookups.

#### `friend_blocks`
Tracks "I removed this person — do not auto-friend us again while we share a group."

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID NOT NULL | the user who removed |
| `blocked_user_id` | UUID NOT NULL | the removed friend |
| `created_at` | TIMESTAMPTZ default `now()` | |

Constraints:
- `PRIMARY KEY (user_id, blocked_user_id)`
- `CHECK (user_id <> blocked_user_id)`

This is **not** a full block list (no message/visibility blocking). It only governs auto-friend behavior. A row is inserted when someone is removed, and **cleared** when a friend request is accepted in either direction (Re-friending wipes the prior removal.)

### Trigger

`on_group_member_insert_auto_friend` — AFTER INSERT on `group_members` for active rows:

For the new member and **every other currently active member of the same group**, build the canonical pair `(min, max)` and:

- If a `friendships` row already exists → skip.
- If either side has a matching row in `friend_blocks` → skip.
- Otherwise INSERT a `friendships` row with `source = 'auto'`.

This handles both group creation (multiple inserts) and post-creation Add Members.

### Backfill

Run once as part of the same migration: for every pair of distinct users that share at least one group with both rows active, INSERT a `friendships` row with `source = 'auto'` (`ON CONFLICT DO NOTHING`). This populates existing users' friends lists so the new picker isn't empty for them.

### RLS

- `friendships`: a user can `SELECT` rows where they are `user_a_id` or `user_b_id`. No direct INSERT/UPDATE/DELETE from clients — all changes go through RPCs.
- `friend_requests`: a user can `SELECT` rows where they are `from_user_id` or `to_user_id`. No direct writes.
- `friend_blocks`: a user can `SELECT` rows where they are `user_id`. No direct writes.

---

## RPC functions (`SECURITY DEFINER`)

All take `auth.uid()` as the implicit caller; all validate inputs.

### `send_friend_request(to_user_id UUID) RETURNS friend_requests`
- Reject if `to_user_id = auth.uid()`.
- Reject if a friendship already exists.
- Reject if a pending request already exists in either direction.
- INSERT a new pending request.

### `accept_friend_request(request_id UUID) RETURNS friendships`
- Verify the row exists, `to_user_id = auth.uid()`, and `status = 'pending'`.
- UPDATE the request to `accepted`, set `responded_at`.
- DELETE any matching `friend_blocks` rows in either direction.
- INSERT a `friendships` row with `source = 'request'` (`ON CONFLICT DO NOTHING`).

### `reject_friend_request(request_id UUID) RETURNS void`
- Verify the row, `to_user_id = auth.uid()`, `status = 'pending'`.
- UPDATE to `rejected`, set `responded_at`.

### `remove_friend(other_user_id UUID) RETURNS void`
- DELETE the friendship row (canonical pair).
- INSERT a `friend_blocks` row `(auth.uid(), other_user_id)` (`ON CONFLICT DO NOTHING`). One-sided — only blocks auto-friend originating from this user's removal action.

### `search_users(query TEXT) RETURNS TABLE (...)`
- Trim and lowercase the query; require length ≥ 2.
- Match `profiles` where `name ILIKE '%q%'` OR `email ILIKE '%q%'` OR `phone LIKE '%q%'`. Limit 50.
- Return each match with the **relationship state** to the caller, computed inline:
  - `'self'` if it's the caller
  - `'friends'` if a friendships row exists
  - `'request_sent'` if pending outgoing
  - `'request_received'` if pending incoming
  - `'none'` otherwise

---

## Mobile layer

### New service: `apps/mobile/services/friends.service.ts`

Thin wrappers over `supabase-js`. Each calls the matching RPC or `from('friendships' | 'friend_requests').select(...)`.

- `fetchFriends()` — returns list of friend profiles
- `fetchIncomingRequests()` — pending where `to_user_id = me`
- `fetchOutgoingRequests()` — pending where `from_user_id = me` (used to show "Pending" state)
- `searchUsers(query)`
- `sendFriendRequest(toUserId)`
- `acceptFriendRequest(requestId)`
- `rejectFriendRequest(requestId)`
- `removeFriend(otherUserId)`

### React Query hooks

- `useFriendsQuery()` — keyed `['friends', me]`
- `useIncomingRequestsQuery()` — keyed `['friend-requests', 'incoming', me]`
- `useSearchUsersQuery(q)` — debounced, disabled below 2 chars
- Mutation hooks for send/accept/reject/remove, invalidating the relevant keys
- Pending incoming count selector for the Profile badge

### New components / screens

- **`AddMembersSheet.tsx`** — centered modal (pattern from `MessageComposerSheet.tsx`).
  - Title: "Add members".
  - Multi-select list of `friends ∖ current group members` using `MemberSelector`.
  - Empty-friends state: copy + "Find friends" button → navigates to `FindFriendsScreen`.
  - "Add" button: calls `addGroupMember` per selected user (existing service in `services/groups.service.ts`), shows simple loading state, on completion closes and refetches the group.

- **`FriendsScreen.tsx`** — accessed from Profile.
  - Top section: incoming requests with Accept / Reject buttons (uses incoming query).
  - Bottom section: friends list. Long-press a row → confirm dialog → `removeFriend`.
  - Pull-to-refresh.

- **`FindFriendsScreen.tsx`**
  - Search input at top, debounced.
  - List of results with per-row state-aware CTA:
    - `none` → "Send request" button
    - `request_sent` → "Pending" disabled
    - `request_received` → "Accept" / "Reject" buttons
    - `friends` → "Friends" checkmark
    - `self` → no actions

### Screen modifications

- **`GroupDetailScreen.tsx`** (around line 366) — empty-feed slot keeps the current "Add expense" button and adds a second prominent "+ Add Members" button under it. Tapping opens `AddMembersSheet` with the current `groupId`.

- **`EditGroupScreen.tsx`** — insert a new **Members** section between the form (after CurrencyPicker) and the Danger Zone:
  - Section heading: "Members" + small "See all" link → existing `GroupMembersScreen`.
  - Horizontal scrollable row of member avatars (use existing `Avatar`/profile-image component).
  - At the end of the row: a circular "+" tile. Tap opens `AddMembersSheet`.

- **`ProfileScreen.tsx`** — add a "Friends" row with a count badge equal to pending incoming requests; tap navigates to `FriendsScreen`.

- **`AppNavigator.tsx`** — register `Friends` and `FindFriends` routes.

### i18n

All new copy goes into the i18n resource files. Keys to add (illustrative):
- `friends.title`, `friends.incomingRequests`, `friends.empty`
- `friends.actions.accept`, `friends.actions.reject`, `friends.actions.remove`, `friends.actions.removeConfirm`
- `friends.find.title`, `friends.find.searchPlaceholder`, `friends.find.send`, `friends.find.pending`
- `groups.members.title`, `groups.members.seeAll`, `groups.members.addMembers`
- `groups.emptyFeed.addMembers`
- `profile.friends`

---

## Build order

| Step | Deliverable | Notes |
|---|---|---|
| 1 | DB migration — tables, trigger, backfill, RLS | One Supabase migration file. Test the backfill on a copy first. |
| 2 | RPC functions | Same migration or follow-up migration. All `SECURITY DEFINER`. |
| 3 | `services/friends.service.ts` + React Query hooks | Pure data layer, no UI. |
| 4 | `AddMembersSheet` component | Standalone, can be tested in isolation. |
| 5 | Wire `AddMembersSheet` into `GroupDetailScreen` empty state and the new `EditGroupScreen` Members section | This delivers the two original asks. Functional for users who have auto-friended contacts from the backfill. |
| 6 | `FriendsScreen` + Profile entry + pending-count badge | Enables Accept/Reject/Remove. |
| 7 | `FindFriendsScreen` | Enables sending new friend requests from scratch. |

After step 5 the two buttons the user asked for are usable for any account with at least one existing shared-group contact (which the backfill provides). Steps 6 and 7 complete the friends-management surface.

---

## Open items / things to verify before each step

- Confirm the exact `profiles` columns used for search (`name`, `email`, `phone`) are populated for typical users — sparse `phone` is fine, sparse `name` would weaken search.
- Confirm there's no existing in-flight migration adding overlapping tables before writing the new migration.
- Confirm the avatar component to reuse for the Edit Group Members section.
- Decide whether the pending-count badge belongs on the Profile **tab icon** or just on the Friends row inside Profile. The decision logged above is "Profile screen Friends row badge"; tab-icon badge is not in scope for v1.
- The `MemberSelector` component is already multi-select capable. Confirm its API supports an `excludeUserIds` prop or filter before reuse; otherwise pass a pre-filtered `users` array.

---

## Out of scope (explicitly)

- Push notifications for incoming friend requests.
- Blocking a user (separate from "remove friend").
- Cancelling an outgoing pending request from the UI.
- A dedicated Friends tab in the bottom tab bar.
- Phone-contact import (`expo-contacts`).
- Restricting `CreateGroup` to friends only.
