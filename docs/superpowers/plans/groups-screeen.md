# Groups Screen Redesign Implementation Plan

**Branch:** `fix-group-screen`
**Target screen:** `apps/mobile/screens/groups/GroupsListScreen.tsx`

**Goal:** Rebuild the main Groups list screen with: expandable search (by group name + member name), filter sheet, subtle top-right create button, a per-currency balance summary header, per-group balance chips on each card, and a large "Create a group" CTA at the end of the list.

**Tech Stack:** Expo / React Native (NativeWind), Zustand store, NestJS server, Supabase Postgres, i18next (en + he, RTL aware).

**Note for implementer:** Before writing any Expo-touching code (animations, sheets, gestures, etc.) read the versioned docs at https://docs.expo.dev/versions/v55.0.0/ — see `apps/mobile/AGENTS.md`.

---

## Design decisions (locked in)

| Decision | Choice |
|---|---|
| Two create CTAs (top-right + bottom) | Top-right is a subtle `+` icon (always). Bottom big button sits at the **end of the list** (scrolls with list, not pinned). |
| Multi-currency summary | One row per currency. **Hide** a row if its amount is 0 (e.g. user owes nothing in USD → no "You owe $0" line). |
| Filter dimensions | All four (balance state, group type, active/archived, currency) inside a single filter sheet. |
| Search UX | Top-left icon that expands into a full-width input. Matches group name OR any active member's display name. |
| Per-group balance chip on each `GroupCard` | Yes. Truncate with `…` if it overflows. |
| Highlight matched member names in card | Yes. Show "incl. {{names}}" subtitle with matches highlighted. |
| Colors | "You are owed" = subtle green (`text-emerald-600`). "You owe" = subtle red (`text-rose-600`). |
| Per-group balance source | **Decision: extend the same `/users/me/balance-summary` endpoint to return both an aggregated `summary[]` and a `byGroup[]` array — one round-trip.** (Revisit if payload gets large.) |

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/types/index.ts` | Add `BalanceSummaryRow`, `GroupBalance`, `BalanceSummaryResponse`, `GroupWithMembers` types |
| `apps/server/src/services/groups.service.ts` | `findAllForUser` returns `GroupWithMembers[]` (join members + profiles) |
| `apps/server/src/services/calculations.service.ts` | Add `getUserBalanceSummary(userId)` → `{ summary, byGroup }` |
| `apps/server/src/controllers/users.controller.ts` | Add `GET /users/me/balance-summary` |
| `apps/server/src/controllers/groups.controller.ts` | Type swap on `findAll` response |
| `apps/server/src/services/__tests__/calculations.service.spec.ts` | Cover aggregation across currencies |
| `apps/mobile/services/groups.service.ts` | `fetchGroups()` return type → `GroupWithMembers[]` |
| `apps/mobile/services/users.service.ts` | Add `fetchBalanceSummary()` |
| `apps/mobile/store/index.ts` (or relevant slice) | Add `balanceSummary` + `groupBalances` state + setters |
| `apps/mobile/components/BalanceSummaryHeader.tsx` | **New.** Renders per-currency owed/owe rows |
| `apps/mobile/components/BalanceChip.tsx` | **New.** Small pill: `owed` / `owe` / `settled` variants, truncates |
| `apps/mobile/components/SearchExpandable.tsx` | **New.** Icon → animated full-width input |
| `apps/mobile/components/FiltersSheet.tsx` | **New.** Bottom sheet with all filter dimensions |
| `apps/mobile/components/HighlightedText.tsx` | **New.** Wraps query matches in highlight span |
| `apps/mobile/components/GroupCard.tsx` | Refactor: accept `balance`, `searchQuery`, `matchedMemberNames` |
| `apps/mobile/screens/groups/GroupsListScreen.tsx` | Rewrite layout + wire search/filter/summary |
| `apps/mobile/i18n/en.json` + `he.json` | New keys (see Task 9) |
| `apps/mobile/__tests__/components/*` | Tests for new components |
| `apps/mobile/__tests__/screens/groups/GroupsListScreen.test.tsx` | Extend coverage |

---

## Task 1: Shared types

**Files:**
- Modify: `packages/shared/src/types/index.ts`

**Steps:**
- [ ] Add `BalanceSummaryRow` interface: `{ currency: string; owed: number; owe: number; net: number }`. `owed` = amount others owe me, `owe` = amount I owe others (both ≥ 0).
- [ ] Add `GroupBalance` interface: `{ groupId: string; currency: string; net: number }`. Positive = I'm owed in this group; negative = I owe.
- [ ] Add `BalanceSummaryResponse` interface: `{ summary: BalanceSummaryRow[]; byGroup: GroupBalance[] }`.
- [ ] Add `GroupMemberLite` interface: `{ userId: string; displayName: string; avatarUrl?: string }`.
- [ ] Add `GroupWithMembers extends Group { members: GroupMemberLite[] }`.
- [ ] Re-export from `packages/shared/src/index.ts` if not auto-exported.
- [ ] Rebuild shared package (`npm run build` in `packages/shared`).

---

## Task 2: Server — extend groups list with members

**Files:**
- Modify: `apps/server/src/services/groups.service.ts`
- Modify: `apps/server/src/controllers/groups.controller.ts`

**Steps:**
- [ ] In `groups.service.ts`, update `findAllForUser(userId)` to JOIN `group_members` and `profiles`, returning `GroupWithMembers[]`. Only include members where `group_members.isActive = true`.
- [ ] In `groups.controller.ts`, change the `findAll` return type to `ApiResponse<GroupWithMembers[]>`.
- [ ] Verify no other callers of `findAllForUser` break.

---

## Task 3: Server — balance summary endpoint

**Files:**
- Modify: `apps/server/src/services/calculations.service.ts`
- Modify: `apps/server/src/controllers/users.controller.ts`
- Create: `apps/server/src/services/__tests__/calculations.service.spec.ts` (or extend existing)

**Steps:**
- [ ] Add `getUserBalanceSummary(userId): Promise<BalanceSummaryResponse>` to `calculations.service.ts`:
  - Query all groups the user belongs to (active membership).
  - For each group, compute the user's `UserBalance` rows via the existing `user_balances_view` logic (currency-aware).
  - Build `byGroup[]` from each group's net for the user (skip rounding-zero rows).
  - Aggregate `summary[]` by currency: sum positive nets into `owed`, sum absolute negatives into `owe`.
  - Drop currencies where both `owed` and `owe` round to 0.
- [ ] Add `GET /users/me/balance-summary` in `users.controller.ts` returning `ApiResponse<BalanceSummaryResponse>`. Use `@CurrentUser()` for the user id (matches the auth pattern in `groups.controller.ts`).
- [ ] Unit test: at least one group user is owed in, one group user owes in, one group with mixed currencies, one settled group. Verify aggregation and the zero-row filter.

---

## Task 4: Mobile — data layer

**Files:**
- Modify: `apps/mobile/services/groups.service.ts`
- Modify: `apps/mobile/services/users.service.ts` (or create if missing)
- Modify: `apps/mobile/store/index.ts` (or the relevant slice)

**Steps:**
- [ ] Update `fetchGroups()` return type to `GroupWithMembers[]`; update store setter to accept the richer type.
- [ ] Add `fetchBalanceSummary(): Promise<BalanceSummaryResponse | null>` that calls `/users/me/balance-summary`, stores result in the store, returns it.
- [ ] In the store, add `balanceSummary: BalanceSummaryRow[]` and `groupBalances: Record<string, GroupBalance>` (indexed by `groupId` for O(1) lookup in the card).
- [ ] Provide selectors: `selectBalanceForGroup(groupId)`, `selectSummary()`.

---

## Task 5: New small components

**Files:**
- Create: `apps/mobile/components/BalanceChip.tsx`
- Create: `apps/mobile/components/HighlightedText.tsx`
- Create: `apps/mobile/components/BalanceSummaryHeader.tsx`

**Steps:**
- [ ] `BalanceChip`:
  - Props: `{ balance?: GroupBalance; defaultCurrency: string }`.
  - Variants by sign of `balance.net`: positive → green (`bg-emerald-50 text-emerald-700`); negative → red (`bg-rose-50 text-rose-700`); zero/undefined → gray "Settled".
  - Use existing currency formatter from `packages/shared/src/utils`.
  - `numberOfLines={1}` + `ellipsizeMode="tail"`; cap `maxWidth` with Tailwind class.
- [ ] `HighlightedText`:
  - Props: `{ text: string; query?: string; highlightClassName?: string; className?: string }`.
  - Case-insensitive split on `query`; renders matched substrings inside an inner `<Text>` with `bg-yellow-100 font-semibold` (or similar). No-op if `query` empty.
- [ ] `BalanceSummaryHeader`:
  - Props: `{ rows: BalanceSummaryRow[] }`.
  - For each row, render up to two lines: `"You are owed {formatted owed}"` in green; `"You owe {formatted owe}"` in red. Skip a line if the value rounds to 0. Skip the whole row if both are 0.
  - If `rows` is empty or all rows are skipped, render `null` (no empty card).
  - Use NativeWind only.

---

## Task 6: Search + filter UI components

**Files:**
- Create: `apps/mobile/components/SearchExpandable.tsx`
- Create: `apps/mobile/components/FiltersSheet.tsx`

**Steps for `SearchExpandable`:**
- [ ] Props: `{ value: string; onChangeText: (v: string) => void; placeholder?: string }`.
- [ ] Collapsed state: icon-only button (search icon). Expanded state: full-width `TextInput` with leading icon and a trailing "Cancel" text button.
- [ ] Animate using `react-native-reanimated` (already in Expo SDK 55). Width animation OK; reduce motion respected via `useReducedMotion`.
- [ ] On Cancel: clear value, collapse, blur.
- [ ] RTL-aware (`I18nManager.isRTL`).

**Steps for `FiltersSheet`:**
- [ ] Check whether `@gorhom/bottom-sheet` is already a dependency. If yes, use it. If not, use React Native's `Modal` with slide-up + backdrop (don't add new deps in this PR unless needed).
- [ ] Props: `{ visible: boolean; filters: Filters; availableCurrencies: string[]; availableTypes: GroupType[]; onApply: (f: Filters) => void; onClose: () => void }`.
- [ ] `Filters` shape:
  ```ts
  type Filters = {
    balanceState: 'all' | 'owe' | 'owed' | 'settled';
    types: GroupType[];          // empty = all
    includeArchived: boolean;
    currencies: string[];        // empty = all
  };
  ```
- [ ] Sections: segmented control for balance state; chip multi-select for types and currencies; switch for archived. Footer with "Clear all" and "Apply".
- [ ] Apply only commits state on button press (not on each toggle), so the user can cancel without consequence.

---

## Task 7: Refactor `GroupCard`

**Files:**
- Modify: `apps/mobile/components/GroupCard.tsx`
- Modify: `apps/mobile/__tests__/components/GroupCard.test.tsx`

**Steps:**
- [ ] New props: `{ group: GroupWithMembers; balance?: GroupBalance; searchQuery?: string; matchedMemberNames?: string[]; onPress }`.
- [ ] Layout (LTR):
  - Avatar (existing `GroupAvatar`)
  - Middle column:
    - Group name (wrap in `HighlightedText` with `query={searchQuery}`)
    - Subtitle row: `{type}` · `{memberCount} members` · (if `matchedMemberNames?.length`) `incl. {highlighted names joined by ", "}` — `numberOfLines={1}`, ellipsized
  - Right: `<BalanceChip balance={balance} defaultCurrency={group.defaultCurrency} />`
  - Chevron (existing)
- [ ] Keep RTL handling for chevron.
- [ ] Extend tests: balance chip variants, member-name highlight, truncation behavior, no chip when `balance` is undefined.

---

## Task 8: Rewrite `GroupsListScreen`

**Files:**
- Modify: `apps/mobile/screens/groups/GroupsListScreen.tsx`
- Modify: `apps/mobile/__tests__/screens/groups/GroupsListScreen.test.tsx`

**Steps:**
- [ ] Local state: `searchQuery: string`, `filters: Filters`, `filtersOpen: boolean`.
- [ ] On mount: `Promise.all([loadGroups(), loadBalanceSummary()])`.
- [ ] On pull-to-refresh: same.
- [ ] Derive `availableCurrencies` from `groups.map(g => g.defaultCurrency)` (unique) for the filter sheet.
- [ ] Derive `availableTypes` from `groups.map(g => g.groupType)` (unique).
- [ ] Compute `filteredGroups` via `useMemo`:
  1. Apply filters in order: balance state (uses store's `groupBalances`), types, archived toggle, currencies.
  2. Apply search match: group name OR any active member's `displayName` contains `searchQuery` (case-insensitive).
- [ ] For each filtered group, derive `matchedMemberNames` (members whose name matched the query) and pass into `GroupCard`.
- [ ] New layout (NativeWind):
  ```
  <SafeAreaView>
    <View row>            // header
      left:  <SearchExpandable />
             <FilterIconButton badged={isAnyFilterActive} onPress={openSheet} />
      right: <IconButton name="add" onPress={handleCreateGroup} />  // subtle
    </View>
    <BalanceSummaryHeader rows={summary} />
    <FlatList
      data={filteredGroups}
      renderItem={…}
      ListFooterComponent={<BigCreateGroupButton onPress={handleCreateGroup} />}
      ListEmptyComponent={existing EmptyState}
      refreshControl={…}
    />
    <FiltersSheet visible={filtersOpen} … />
  </SafeAreaView>
  ```
- [ ] `BigCreateGroupButton` can stay inline in this file (one-off) OR live in `components/` — implementer's call.
- [ ] Tests to add/update:
  - Search filters list by group name.
  - Search filters list by member name.
  - Filter sheet — applying "You owe" hides groups with non-negative balance.
  - Summary header hidden when summary is empty.
  - Big bottom CTA renders only when list has items (not when empty — `EmptyState` covers that).

---

## Task 9: i18n keys

**Files:**
- Modify: `apps/mobile/i18n/en.json`
- Modify: `apps/mobile/i18n/he.json`

**New keys (add under `groups.*`):**

```
"groups.search.placeholder"           // "Search groups or members"
"groups.search.cancel"                // "Cancel"
"groups.filters.title"                // "Filters"
"groups.filters.apply"                // "Apply"
"groups.filters.clearAll"             // "Clear all"
"groups.filters.balance.label"        // "Balance"
"groups.filters.balance.all"          // "All"
"groups.filters.balance.owe"          // "I owe"
"groups.filters.balance.owed"         // "I'm owed"
"groups.filters.balance.settled"      // "Settled"
"groups.filters.type.label"           // "Group type"
"groups.filters.status.label"         // "Status"
"groups.filters.status.includeArchived" // "Show archived"
"groups.filters.currency.label"       // "Currency"
"groups.summary.youAreOwed"           // "You are owed {{amount}}"
"groups.summary.youOwe"               // "You owe {{amount}}"
"groups.card.matchedMembers"          // "incl. {{names}}"
"groups.card.settled"                 // "Settled"
"groups.bigCreateCta"                 // "Create a group"
```

- [ ] Add English values.
- [ ] Add Hebrew translations (RTL handled by NativeWind/RN automatically; check ordering visually).

---

## Task 10: Manual QA pass

- [ ] Empty state (zero groups): no summary header, no list footer CTA, existing `EmptyState` shows.
- [ ] Multi-currency: groups in ILS + USD render two summary blocks.
- [ ] Settled group: `BalanceChip` shows gray "Settled" label.
- [ ] Long balance number truncates with `…`.
- [ ] Search expand/collapse: smooth, focuses input on open, blurs + clears on Cancel.
- [ ] Search matching members: typing a member name shows matched groups; `incl. <highlighted names>` appears on card.
- [ ] Filter sheet: each section works in isolation and combined; "Clear all" resets without applying; "Apply" closes sheet and badge appears on the filter icon when any filter is active.
- [ ] RTL (he): icons mirror; chevron reverses; summary numbers right-aligned.
- [ ] Pull-to-refresh re-fetches both groups and balance summary.

---

## Suggested build order

1. Task 1 (shared types) — no behavior change, unblocks both server and mobile.
2. Tasks 2 + 3 (server) — verify with curl/Postman.
3. Task 4 (mobile data layer) — store is in place before any UI work.
4. Task 5 (small components) — unit-testable in isolation.
5. Task 7 (GroupCard refactor) — the card is the visual anchor of the screen.
6. Task 8 (screen rewrite) — wire it together.
7. Task 6 (FiltersSheet + SearchExpandable) — can also be done in parallel with 8 if desired.
8. Task 9 (i18n) — done as you encounter strings; final sweep at the end.
9. Task 10 (manual QA) — last.

---

## Out of scope (do NOT do in this branch)

- Group archiving feature itself (the filter assumes a future archived flag; if `Group.isActive` is the only flag today, "Show archived" toggles between `isActive=true` only vs all).
- Server-side search endpoint — search stays client-side using the members payload.
- Group invite flow.
- Changes to `GroupDetailScreen`, `CreateGroupScreen`, `EditGroupScreen`, `GroupMembersScreen` beyond required type updates