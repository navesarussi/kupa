# Settlement Detail Popup — v2 Handoff Alignment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing `FeedItemDetailSheet` settlement branch into 1:1 alignment with the v2 design handoff at [`docs/design_handoff_settlement_detail 2/`](../../design_handoff_settlement_detail%202/), fixing two real spec gaps (sheet shadow direction, kebab menu vertical offset) and locking compliance with a structured audit + tests.

**Architecture:** No new components. The settlement detail popup is already implemented in [`cost-share-app/apps/mobile/components/FeedItemDetailSheet.tsx`](../../../cost-share-app/apps/mobile/components/FeedItemDetailSheet.tsx) and [`cost-share-app/apps/mobile/components/DetailSheetHeader.tsx`](../../../cost-share-app/apps/mobile/components/DetailSheetHeader.tsx). All required i18n keys exist in `en.json` + `he.json`. Wiring exists in `GroupDetailScreen`, `ActivityFeedScreen`, and `SettleUpListScreen`. This plan only touches the two spec drifts plus adds a `shadows.sheet` token.

**Tech Stack:** React Native + Expo SDK 55 · NativeWind · `expo-linear-gradient` · `react-i18next` · Jest + `@testing-library/react-native`

**Spec source:** [`docs/design_handoff_settlement_detail 2/README.md`](../../design_handoff_settlement_detail%202/README.md)

---

## Conventions used in this plan

- Working directory for all bash commands: `cost-share-app/apps/mobile/`
- File paths in tasks are relative to that working directory unless explicitly absolute
- Tests run with: `npm test -- <file>` or `npx jest <file>`
- Type-check: `npx tsc --noEmit -p tsconfig.json`
- Lint: `npm run lint`
- Commit messages follow the existing convention: `fix(...)`, `feat(...)`, `test(...)`, `chore(...)`

---

## Pre-flight: confirm current state matches assumptions

The v2 design is ~95% implemented. Before changing anything, the executor must confirm the baseline is what this plan expects. This is one read-only audit task — no code changes.

### Task 0: Read-only audit against v2 spec

**Files (read only):**
- Read: `components/FeedItemDetailSheet.tsx`
- Read: `components/DetailSheetHeader.tsx`
- Read: `components/MemberAvatar.tsx`
- Read: `theme/shadows.ts`
- Read: `i18n/locales/en.json` (search for `"settleUp":`)
- Read: `i18n/locales/he.json` (search for `"settleUp":`)
- Read: `../../../docs/design_handoff_settlement_detail 2/README.md`

- [ ] **Step 1: Verify the sheet wrapper matches spec**

Open `components/FeedItemDetailSheet.tsx` and confirm at the file level:
- The settlement branch dispatches via `item.kind === 'settlement'` and renders `<SettlementDetailBody>`.
- The sheet `View` has `borderTopLeftRadius: 24`, `borderTopRightRadius: 24`, `maxHeight: '88%'`, `overflow: 'hidden'`.
- The scrim style is `rgba(15, 23, 42, 0.55)`.
- The drag handle is `w-10 h-1 rounded-full bg-gray-200` centered with `mt-2.5 mb-2`.
- `<DetailSheetHeader>` is rendered with `label={t('settleUp.detailHeaderLabel')}` when settlement.

If any of the above is wrong, STOP and surface the mismatch — this plan assumes they hold.

- [ ] **Step 2: Verify the hero card matches spec**

In the same file, confirm `SettlementHero`:
- Container height is `180`, `borderRadius` 16 (from `rounded-2xl`), `borderColor: '#A7F3D0'`.
- Gradient colors are `['#10B981', '#047857']` with start `{x:0,y:0}` end `{x:1,y:1}` (135°).
- Top + bottom scrim is a `LinearGradient` with locations `[0, 0.3, 0.7, 1]` and alpha `0.18 / 0 / 0 / 0.18`.
- Payment chip: `top: 10`, `left: 10`, bg `rgba(0,0,0,0.45)`, contains a 12px `checkmark-circle` + text `t('settleUp.payment')`.
- Date is positioned `top: 12`, `right: 14`, fontSize 11, color `rgba(255,255,255,0.92)`.
- Three children: `FlowPerson` (from), arrow+amount column (`flex: 1`), `FlowPerson` (to).
- Arrow uses `chevron-forward` (LTR) / `chevron-back` (RTL).

- [ ] **Step 3: Verify the involvement strip matches spec**

Confirm `SettlementInvolvementStrip`:
- Container: `bg #ECFDF5`, border `#A7F3D0`, `borderRadius: 12`, `mx-4 mt-3.5 mb-6`, `paddingVertical: 14`, `paddingHorizontal: 14`.
- Left icon container: 36×36 white circle, radius 9999.
- Icon name maps: recipient → `arrow-down-circle-outline`, payer → `arrow-up-circle-outline`, otherwise → `swap-horizontal-outline`. Color `colors.success`.
- Heading: 15px / 700, color `#047857`.
- Sub line: 12px, color `#047857`, opacity 0.8, marginTop 2.

- [ ] **Step 4: Verify i18n keys exist in BOTH locales**

Run:
```bash
grep -nE "\"detailHeaderLabel\"|\"payment\"|\"paid\"|\"received\"|\"youReceivedAmount\"|\"youPaidAmount\"|\"someonePaid\"|\"fromVia\"|\"toVia\"|\"fromName\"|\"toName\"|\"via\":" i18n/locales/en.json i18n/locales/he.json
```

Expected: each of `detailHeaderLabel`, `payment`, `paid`, `received`, `youReceivedAmount`, `youPaidAmount`, `someonePaid`, `fromVia`, `toVia`, `fromName`, `toName`, `via` appears in BOTH files under the `settleUp` namespace. If any is missing in `he.json`, add a task at the end of this plan to fill it.

- [ ] **Step 5: Verify the spec gaps this plan targets are real**

Open `components/DetailSheetHeader.tsx` and confirm `styles.menuCard.top === 42`. Spec says 38.
Open `theme/shadows.ts` and confirm there is NO `shadows.sheet` entry. Open `components/FeedItemDetailSheet.tsx` and confirm the sheet uses `shadows.lg` (which has downward `shadowOffset.height: 4`). Spec says `0 -8px 24px rgba(0,0,0,0.15)` — upward.

- [ ] **Step 6: Audit complete — report findings**

Write a short summary (under 200 words) of:
- Confirmations of all items above.
- Anything that drifted from this plan's assumptions (extra fields, renamed props, etc.).

Do NOT commit anything in this task.

---

## Task 1: Add a sheet-specific upward shadow token

**Spec:** "Shadow: `0 -8px 24px rgba(0,0,0,0.15)`" (handoff `README.md` line 62).
**Current:** Sheet uses `shadows.lg` from `theme/shadows.ts`, which has `shadowOffset: { width: 0, height: 4 }` (downward) and `shadowRadius: 8`.
**Why this is wrong:** A sheet that slides UP from the bottom should cast its shadow UPWARD onto the screen behind it. A downward shadow disappears off-screen and produces no edge glow above the sheet.

**Files:**
- Modify: `theme/shadows.ts`
- Modify: `components/FeedItemDetailSheet.tsx` (the `<View style={[styles.sheet, shadows.lg]}>` line)
- Test: `__tests__/components/FeedItemDetailSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

Open `__tests__/components/FeedItemDetailSheet.test.tsx`. Find an existing settlement-render test (search for `settlement-detail-sheet`). Add this new test alongside it:

```tsx
import { shadows } from '../../theme/shadows';

it('applies the upward sheet shadow on iOS', () => {
    const { getByTestId } = renderWithQuery(
        <FeedItemDetailSheet
            item={{ kind: 'settlement', settlement: mockSettlement }}
            memberMap={mockMemberMap}
            currentUserId="user-1"
            onClose={jest.fn()}
            onEdit={jest.fn()}
            onDelete={jest.fn()}
        />,
    );
    const sheet = getByTestId('settlement-detail-sheet');
    // Flatten the style array (sheet style + shadow style)
    const flat = StyleSheet.flatten(sheet.props.style);
    // Spec: 0 -8px 24px rgba(0,0,0,0.15)
    expect(flat.shadowOffset).toEqual({ width: 0, height: -8 });
    expect(flat.shadowRadius).toBe(24);
    expect(flat.shadowOpacity).toBeCloseTo(0.15, 2);
});
```

Reuse whatever `mockSettlement` / `mockMemberMap` / `renderWithQuery` already exist in that file — do NOT introduce new mocks.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest __tests__/components/FeedItemDetailSheet.test.tsx -t "upward sheet shadow"
```

Expected: FAIL. Either `shadowOffset.height` is `4` (from `shadows.lg`) or `shadowRadius` is `8`, not the spec values.

- [ ] **Step 3: Add the `sheet` shadow token**

In `theme/shadows.ts`, add a new entry inside the `shadows` object (place it after `xl`, before any trailing exports):

```ts
sheet: Platform.select({
    ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
    },
    android: {
        elevation: 12,
    },
    default: {},
}),
```

Note the negative `height: -8` — that's the whole point. Android can't render directional shadows, so we just give it a high `elevation` to keep parity with the visual lift of the iOS shadow.

- [ ] **Step 4: Swap the sheet's shadow usage**

In `components/FeedItemDetailSheet.tsx`, find:

```tsx
<View
    style={[styles.sheet, shadows.lg]}
    testID={
```

Change `shadows.lg` to `shadows.sheet`:

```tsx
<View
    style={[styles.sheet, shadows.sheet]}
    testID={
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx jest __tests__/components/FeedItemDetailSheet.test.tsx -t "upward sheet shadow"
```

Expected: PASS.

- [ ] **Step 6: Run the full sheet test file to confirm no regressions**

```bash
npx jest __tests__/components/FeedItemDetailSheet.test.tsx
```

Expected: all pre-existing tests still pass.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add theme/shadows.ts components/FeedItemDetailSheet.tsx __tests__/components/FeedItemDetailSheet.test.tsx
git commit -m "fix(detail-sheet): apply upward sheet shadow per v2 spec"
```

---

## Task 2: Move kebab popover anchor from 42 px to 38 px

**Spec:** "Anchor | 38 px below the kebab, right-aligned to the kebab" (handoff `README.md` line 88).
**Current:** `components/DetailSheetHeader.tsx:135` has `top: 42`.
**Why this matters:** The 4-px drift visibly lowers the popover relative to the kebab icon. It looks especially wrong against the 32-px tall hero card top margin — the popover overlaps the chip more than designed.

**Files:**
- Modify: `components/DetailSheetHeader.tsx:135`
- Test: `__tests__/components/DetailSheetHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

Open `__tests__/components/DetailSheetHeader.test.tsx`. Add this test (place it after any existing menu-open test):

```tsx
it('positions the kebab popover 38 px below the trigger per design spec', () => {
    const { getByTestId } = render(
        <DetailSheetHeader
            label="SETTLEMENT"
            onClose={jest.fn()}
            onEdit={jest.fn()}
            onDelete={jest.fn()}
        />,
    );
    fireEvent.press(getByTestId('detail-kebab-btn'));
    const editBtn = getByTestId('detail-edit-btn');
    // The edit button lives inside the menu card. Walk up to the card
    // (parent View) and read its top offset.
    const menuCard = editBtn.parent;
    const flat = StyleSheet.flatten(menuCard?.props.style);
    expect(flat.top).toBe(38);
});
```

If `StyleSheet` is not already imported at the top of the test file, add: `import { StyleSheet } from 'react-native';`

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest __tests__/components/DetailSheetHeader.test.tsx -t "38 px below"
```

Expected: FAIL — current value is 42.

- [ ] **Step 3: Update the offset**

In `components/DetailSheetHeader.tsx`, change `styles.menuCard.top`:

```ts
menuCard: {
    position: 'absolute',
    top: 38,
    right: 4,
    minWidth: 160,
    padding: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8,
    zIndex: 10,
},
```

(Only `top: 42` → `top: 38` changes; the rest is unchanged.)

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest __tests__/components/DetailSheetHeader.test.tsx -t "38 px below"
```

Expected: PASS.

- [ ] **Step 5: Run the full header test file to confirm no regressions**

```bash
npx jest __tests__/components/DetailSheetHeader.test.tsx
```

Expected: all pre-existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add components/DetailSheetHeader.tsx __tests__/components/DetailSheetHeader.test.tsx
git commit -m "fix(detail-sheet): anchor kebab popover at 38px per v2 spec"
```

---

## Task 3: Pin the three involvement-strip cases with tests

The three involvement cases (recipient / payer / neither) are already implemented but only two are covered by tests today. Pin all three so future drift gets caught.

**Files:**
- Test: `__tests__/components/FeedItemDetailSheet.test.tsx`

- [ ] **Step 1: Audit which cases are already tested**

Open `__tests__/components/FeedItemDetailSheet.test.tsx`. Search for `youReceivedAmount`, `youPaidAmount`, `someonePaid`. List which of the three currently has a test. Only add tests for the missing ones in the next step — DO NOT duplicate.

- [ ] **Step 2: Add the missing-case tests**

For each of the three cases that does NOT already have a test, append one. Below are the templates — use only the ones you need based on Step 1.

```tsx
it('shows "You received {amount}" when the current user is the recipient', () => {
    const settlement = {
        ...mockSettlement,
        fromUserId: 'user-other',
        toUserId: 'user-1',
        amount: 18,
        currency: 'USD',
        paymentMethod: 'bank_transfer' as const,
    };
    const { getByText } = renderWithQuery(
        <FeedItemDetailSheet
            item={{ kind: 'settlement', settlement }}
            memberMap={{
                'user-1': { id: 'user-1', displayName: 'Me', avatarUrl: null },
                'user-other': { id: 'user-other', displayName: 'David', avatarUrl: null },
            }}
            currentUserId="user-1"
            onClose={jest.fn()}
            onEdit={jest.fn()}
            onDelete={jest.fn()}
        />,
    );
    expect(getByText('You received USD 18.00')).toBeTruthy();
    expect(getByText('From David · via Bank Transfer')).toBeTruthy();
});

it('shows "You paid {amount}" when the current user is the payer', () => {
    const settlement = {
        ...mockSettlement,
        fromUserId: 'user-1',
        toUserId: 'user-other',
        amount: 25,
        currency: 'USD',
        paymentMethod: 'cash' as const,
    };
    const { getByText } = renderWithQuery(
        <FeedItemDetailSheet
            item={{ kind: 'settlement', settlement }}
            memberMap={{
                'user-1': { id: 'user-1', displayName: 'Me', avatarUrl: null },
                'user-other': { id: 'user-other', displayName: 'Sarah', avatarUrl: null },
            }}
            currentUserId="user-1"
            onClose={jest.fn()}
            onEdit={jest.fn()}
            onDelete={jest.fn()}
        />,
    );
    expect(getByText('You paid USD 25.00')).toBeTruthy();
    expect(getByText('To Sarah · via Cash')).toBeTruthy();
});

it('shows "{from} paid {to}" when current user is neither party', () => {
    const settlement = {
        ...mockSettlement,
        fromUserId: 'user-a',
        toUserId: 'user-b',
        amount: 12,
        currency: 'USD',
        paymentMethod: 'venmo' as const,
    };
    const { getByText } = renderWithQuery(
        <FeedItemDetailSheet
            item={{ kind: 'settlement', settlement }}
            memberMap={{
                'user-1': { id: 'user-1', displayName: 'Me', avatarUrl: null },
                'user-a': { id: 'user-a', displayName: 'David', avatarUrl: null },
                'user-b': { id: 'user-b', displayName: 'Sarah', avatarUrl: null },
            }}
            currentUserId="user-1"
            onClose={jest.fn()}
            onEdit={jest.fn()}
            onDelete={jest.fn()}
        />,
    );
    expect(getByText('David paid Sarah')).toBeTruthy();
    expect(getByText('via Venmo')).toBeTruthy();
});
```

If the file's `mockSettlement` does not already have all the fields above (especially `paymentMethod`), extend the existing mock — don't introduce a new one.

- [ ] **Step 3: Run the new tests**

```bash
npx jest __tests__/components/FeedItemDetailSheet.test.tsx -t "current user"
```

Expected: all three pass.

- [ ] **Step 4: Run the full test file**

```bash
npx jest __tests__/components/FeedItemDetailSheet.test.tsx
```

Expected: no regressions.

- [ ] **Step 5: Commit**

```bash
git add __tests__/components/FeedItemDetailSheet.test.tsx
git commit -m "test(detail-sheet): cover all three involvement-strip cases"
```

---

## Task 4: RTL chevron flip regression test

**Spec:** "in RTL the 'To' column moves to the left, the 'From' to the right, and the arrow flips direction (`chevron-back` instead of `chevron-forward`)" (handoff `README.md` line 250).
**Current:** `SettlementHero` reads `isRtl` and picks `chevron-back` vs `chevron-forward`. The flex container relies on writing direction to mirror the columns. No test pins this today.

**Files:**
- Test: `__tests__/components/FeedItemDetailSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/components/FeedItemDetailSheet.test.tsx`:

```tsx
import * as RtlLayout from '../../hooks/useRtlLayout';

it('renders chevron-back in the hero when language is Hebrew (RTL)', () => {
    const spy = jest.spyOn(RtlLayout, 'useAppLanguage').mockReturnValue('he');
    try {
        const { UNSAFE_getAllByType } = renderWithQuery(
            <FeedItemDetailSheet
                item={{ kind: 'settlement', settlement: mockSettlement }}
                memberMap={mockMemberMap}
                currentUserId="user-1"
                onClose={jest.fn()}
                onEdit={jest.fn()}
                onDelete={jest.fn()}
            />,
        );
        // AppIcon is a thin wrapper — query by name prop on the wrapper.
        const icons = UNSAFE_getAllByType(AppIcon as any);
        const hasBack = icons.some((i: any) => i.props.name === 'chevron-back');
        const hasForward = icons.some((i: any) => i.props.name === 'chevron-forward');
        expect(hasBack).toBe(true);
        expect(hasForward).toBe(false);
    } finally {
        spy.mockRestore();
    }
});
```

Import `AppIcon` at the top of the file if it isn't already.

- [ ] **Step 2: Run the test**

```bash
npx jest __tests__/components/FeedItemDetailSheet.test.tsx -t "Hebrew (RTL)"
```

Expected: PASS (the implementation already supports this — this is a regression pin).

If it fails, the implementation has drifted from the spec. STOP and report; do not "fix" the test to match current behavior.

- [ ] **Step 3: Commit**

```bash
git add __tests__/components/FeedItemDetailSheet.test.tsx
git commit -m "test(detail-sheet): pin RTL chevron-back behavior in settlement hero"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full test run for touched areas**

```bash
npx jest __tests__/components/FeedItemDetailSheet.test.tsx __tests__/components/DetailSheetHeader.test.tsx
```

Expected: all green.

- [ ] **Step 2: Full type-check**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: zero errors.

- [ ] **Step 3: Lint**

```bash
npm run lint -- components/FeedItemDetailSheet.tsx components/DetailSheetHeader.tsx theme/shadows.ts
```

Expected: zero new warnings/errors.

- [ ] **Step 4: Manual visual diff (one device)**

Open the design prototype in a browser:
```bash
open "../../../docs/design_handoff_settlement_detail 2/prototype/settlement-detail.html"
```

Start the Expo dev server and open the app on any one platform (iOS sim or web):
```bash
npm run start
```

In the app: open any group → tap a settlement row in the activity feed → the sheet opens.

Compare to the prototype side-by-side. Specifically check:
1. The sheet's top edge has a soft upward shadow (was absent before Task 1).
2. Tapping the kebab opens a popover that sits visually right under the kebab icon, not floating below it (Task 2).
3. Hero gradient runs corner-to-corner (135°). Chip top-left, date top-right.
4. The from/to flow stays centered; PAID/RECEIVED labels are uppercase, tiny, dim.
5. Involvement strip is green-tinted, with a white circle around the arrow icon.

If anything else drifts from the prototype, file it as a follow-up — do NOT scope-creep this plan.

- [ ] **Step 5: Final commit (only if any uncommitted changes exist from Step 4 testing)**

```bash
git status
```

If clean: nothing to do. If anything modified during manual testing: revert it (`git restore <file>`) unless it's a legitimate fix that warrants its own follow-up plan.

---

## Out of scope (intentionally deferred)

These items from the v2 handoff are NOT covered by this plan. Each is either already correct, optional in the spec, or a separate concern:

- **Tap on hero avatars to open shared-balance view** — Listed as "(Optional)" in the spec under Interactions. Not implemented today. Adding it is a separate feature plan, not a polish task.
- **Letter-spacing micro-drifts** — PAID/RECEIVED current `0.8`, spec `0.08em ≈ 0.72`. SETTLEMENT label current `0.7`, spec `0.06em ≈ 0.72`. Sub-pixel rendering on mobile, not visually distinguishable. Adjust only if QA flags it.
- **Avatar glow ring** — Spec uses CSS `box-shadow: 0 0 0 3px rgba(255,255,255,0.25)` (a pure outer ring). Current uses a `padding: 3, backgroundColor: 'rgba(255,255,255,0.25)'` wrapper which produces the same visual effect on RN (since RN has no `box-shadow`). Equivalent.
- **Hero card padding tokens** — Current `px-4 pt-1` = `16px 4px 0`. Spec `4px 16px 0 16px`. Identical.
- **Bottom-sheet swipe-down dismissal** — RN `Modal` with `animationType="slide"` does not natively support drag-to-dismiss; the current handle is visual-only. Migrating to a real bottom-sheet library (`@gorhom/bottom-sheet`) is a much larger change touching the expense detail sibling as well — track separately.

---

## Spec coverage matrix

| Spec section | Status | Where |
|---|---|---|
| Bottom-sheet chrome (radius, max-height, scrim) | ✅ Already implemented | `FeedItemDetailSheet.tsx` `styles.sheet`, `styles.backdrop` |
| Drag handle | ✅ Already implemented | `FeedItemDetailSheet.tsx:118` |
| Sheet upward shadow | 🔧 **Fixed by Task 1** | `theme/shadows.ts` + `FeedItemDetailSheet.tsx` |
| Header (close · SETTLEMENT · kebab) | ✅ Already implemented | `DetailSheetHeader.tsx` |
| Kebab popover (Edit + Delete) | ✅ Already implemented | `DetailSheetHeader.tsx:82-126` |
| Kebab anchor offset (38 px) | 🔧 **Fixed by Task 2** | `DetailSheetHeader.tsx:135` |
| Hero card (gradient + scrim + chip + date) | ✅ Already implemented | `SettlementHero` in `FeedItemDetailSheet.tsx:479` |
| From → amount → To flow | ✅ Already implemented | `FlowPerson` + amount column in `FeedItemDetailSheet.tsx:574-635` |
| Involvement strip (3 cases) | ✅ Already implemented + 🧪 **Pinned by Task 3** | `SettlementInvolvementStrip` |
| RTL chevron flip | ✅ Already implemented + 🧪 **Pinned by Task 4** | `SettlementHero` `chevronName` |
| i18n keys (en + he) | ✅ Already present | `i18n/locales/en.json` + `he.json`, `settleUp.*` namespace |
| Entry points (group / activity / settle-up) | ✅ Already wired | `GroupDetailScreen.tsx:765`, `ActivityFeedScreen.tsx:350`, `SettleUpListScreen.tsx:335` |
| Delete via `ConfirmDialog` | ✅ Already wired | `SettleUpListScreen.tsx:204`, `GroupDetailScreen.tsx` |
