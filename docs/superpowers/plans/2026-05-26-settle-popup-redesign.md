# Settle-Up Popup Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the existing `SettleUpSheet` to match the 2026-05-26 settle-up design handoff: a 62%-height bottom sheet with an emerald gradient hero (From → editable amount → To, with currency picker + swap), method tiles (Cash / Bank / PayPal / Other), a centered date chip, and a "Record payment · USD 18.00" primary button.

**Architecture:** Keep `SettleUpSheet.tsx` as the single component file — overwrite its body. Extract three local sub-components (`SettleUpHero`, `MethodTiles`, `SettleUpBottomDock`) so each part fits in context. Add a thin `BottomSheetShell` wrapper (drag handle + scrim + header row) used by `SettleUpSheet` now and reusable for `SettlementDetailSheet` later. Extend `theme/colors.ts` + `tailwind.config.js` with the three missing tokens. Extend `SettleUpFormValues` with `paymentMethod` + `settlementDate` and update the three call sites. Wire to existing `createSettlement` service unchanged.

**Tech Stack:** React Native + Expo SDK 55 · NativeWind · `expo-linear-gradient` · `@react-native-community/datetimepicker` (already a transitive dep — verify in Task 6) · `react-i18next` · Jest + `@testing-library/react-native`

**Spec:** [`docs/design_handoff_settle/README.md`](../../design_handoff_settle/README.md)

---

## Conventions used in this plan

- All bash commands run from `cost-share-app/apps/mobile/` unless noted. Example: `cd cost-share-app/apps/mobile && npm test`.
- Test runner: `jest` via `npm test`. Single file: `npm test -- __tests__/components/SettleUpSheet.test.tsx`.
- Commit style matches recent history: `feat(mobile): …`, `refactor(mobile): …`, `test(mobile): …`, `i18n(mobile): …`, `theme(mobile): …`. End every commit with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` per repo norm.
- Branch is `settlement-popup-redesign` (already current).
- Mobile AGENTS.md requires checking Expo v55 docs and confirming the dev Supabase env (`drxfbicunusmipdgbgdk`) before running the app. Honor that.
- Color values come from `docs/design_handoff_settle/README.md` "Design tokens used" section — quote them verbatim from there if you need to double-check.

## What's already there (don't re-create)

| Existing | Path | Notes |
|---|---|---|
| `SettleUpSheet` | `components/SettleUpSheet.tsx` | Rewrite, don't replace the file path. Three call sites consume its props. |
| `MemberAvatar` | `components/MemberAvatar.tsx` | Props: `name`, `avatarUrl?`, `size? 'xs'|'sm'|'md'|'lg'`, `pixelSize?`, `testID?`. Use `pixelSize={44}` for the hero. |
| `AppIcon` | `components/AppIcon.tsx` | Props: `name` (Ionicons), `size?`, `color?`, `testID?`. |
| `AppText` (as `Text`) | `components/AppText.tsx` | Always import `Text` from here, not `react-native`. |
| `Button` | `components/Button.tsx` | Use for the primary "Record payment" button. |
| `useRtlLayout` | `hooks/useRtlLayout.tsx` | `const isRtl = useRtlLayout();` |
| `createSettlement` | `services/settlements.service.ts:52` | DTO: `groupId, fromUserId, toUserId, amount, currency, paymentMethod, settlementDate?`. Already shows the success toast. **Do not modify.** |
| Existing i18n root keys | `i18n/locales/en.json` | `common.cancel`, `common.save`, `settleUp.title`, `settleUp.toastRecorded`, `settleUp.payer`, `settleUp.receiver`, `settleUp.submit`, `settlements.methods.{cash,bank_transfer,paypal,other}`. |

## File map

| File | Action | Responsibility |
|---|---|---|
| `cost-share-app/apps/mobile/theme/colors.ts` | Modify | Add `success.border`, `border.soft`. |
| `cost-share-app/apps/mobile/tailwind.config.js` | Modify | Expose `success-border`, `border-soft`, `shadow-fab`, `shadow-sheet`. |
| `cost-share-app/apps/mobile/i18n/locales/en.json` | Modify | Add 5 keys under `settleUp.*`. |
| `cost-share-app/apps/mobile/i18n/locales/he.json` | Modify | Same 5 keys in Hebrew. |
| `cost-share-app/apps/mobile/components/BottomSheetShell.tsx` | Create | Reusable wrapper: scrim, sheet container, drag handle, header row (Cancel / label / Save). |
| `cost-share-app/apps/mobile/components/SettleUpSheet.tsx` | Rewrite | Compose `BottomSheetShell` + hero + method tiles + bottom dock. Three local sub-components. |
| `cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx` | Modify | Pass new `paymentMethod` / `settlementDate` through to `createSettlement` (line ~858–874 region). |
| `cost-share-app/apps/mobile/screens/balances/SettleUpListScreen.tsx` | Modify | Same. Two call sites (line 317, line 358). |
| `cost-share-app/apps/mobile/screens/balances/BalancesScreen.tsx` | Modify | Same. One call site (line 271). |
| `cost-share-app/apps/mobile/__tests__/components/BottomSheetShell.test.tsx` | Create | Unit tests for shell: scrim dismiss, Cancel/Save callbacks, label render. |
| `cost-share-app/apps/mobile/__tests__/components/SettleUpSheet.test.tsx` | Create | Tests: defaults pre-fill from `initial`, swap flips ids, method selection, amount edit, submit payload includes `paymentMethod` + `settlementDate`. |

No new routes. No service changes. No store changes.

---

## Task 1: Extend theme tokens

Add the three missing tokens. The design references `success-border` (#A7F3D0), `border-soft` (#F1F5F9), and `shadow-fab` / `shadow-sheet`. The current `colors.ts` has no `success.border` key and tailwind has no `shadow-fab`.

**Files:**
- Modify: `cost-share-app/apps/mobile/theme/colors.ts`
- Modify: `cost-share-app/apps/mobile/tailwind.config.js`

- [ ] **Step 1.1: Inspect current shape**

Run: `cd cost-share-app/apps/mobile && cat theme/colors.ts | head -60`
Expected: `colors.success` is a flat string `'#10B981'`, and `colors.border` is `{ default, dark, light }`. Confirm before editing — if shapes differ, adjust the edit accordingly.

- [ ] **Step 1.2: Convert `success` to an object and add `border.soft`**

Edit `theme/colors.ts`. Replace the flat `success: '#10B981'` with:

```ts
    success: {
        DEFAULT: '#10B981',  // Green 500 (current value, kept under DEFAULT)
        text: '#047857',     // Green 700 — design's "success-text"
        border: '#A7F3D0',   // Green 200 — design's "success-border"
    },
```

And in the `border` block, add `soft`:

```ts
    border: {
        default: '#E5E7EB',
        dark: '#D1D5DB',
        light: '#F3F4F6',
        soft: '#F1F5F9',     // design's "border.soft"
        card: '#E2E8F0',     // design's "border.card"
    },
```

- [ ] **Step 1.3: Find and update existing consumers of `colors.success`**

Run: `cd cost-share-app/apps/mobile && grep -rn "colors\.success" --include="*.ts" --include="*.tsx" .`
Expected: a list of files (likely a handful). For each hit that reads `colors.success` as a string, change to `colors.success.DEFAULT`. **Read every hit** — don't blanket-rename. Commit any such changes as part of this task.

- [ ] **Step 1.4: Add tailwind classes**

Open `cost-share-app/apps/mobile/tailwind.config.js`. In the `theme.extend.colors` block add:

```js
        'success-border': '#A7F3D0',
        'success-text': '#047857',
        'border-soft': '#F1F5F9',
        'border-card': '#E2E8F0',
```

In `theme.extend.boxShadow` add:

```js
        'sheet': '0 -8px 24px rgba(0, 0, 0, 0.18)',
        'fab': '0 6px 16px rgba(59, 130, 246, 0.35)',
```

- [ ] **Step 1.5: Type check**

Run: `cd cost-share-app/apps/mobile && npx tsc --noEmit`
Expected: PASS with no new errors. If `colors.success.DEFAULT` consumers break, fix in this same task.

- [ ] **Step 1.6: Commit**

```bash
git add cost-share-app/apps/mobile/theme/colors.ts cost-share-app/apps/mobile/tailwind.config.js
git commit -m "$(cat <<'EOF'
theme(mobile): add success-border, border-soft, shadow-fab tokens

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add i18n keys

Five new keys under `settleUp.*`. Hebrew translations come from existing patterns in `he.json` (look at how `settleUp.payer` is translated for tone).

**Files:**
- Modify: `cost-share-app/apps/mobile/i18n/locales/en.json`
- Modify: `cost-share-app/apps/mobile/i18n/locales/he.json`

- [ ] **Step 2.1: Locate the `settleUp` block in en.json**

Run: `grep -n '"settleUp"' cost-share-app/apps/mobile/i18n/locales/en.json`
Expected: a line number around 566. Note the existing keys in that block.

- [ ] **Step 2.2: Add keys to en.json**

Inside the `"settleUp": { … }` block (around line 566), add these five keys (preserve trailing commas correctly):

```json
"newPayment": "New payment",
"from": "From",
"to": "To",
"swap": "Swap",
"method": "Method",
"recordPaymentWithAmount": "Record payment · {{currencyAndAmount}}"
```

- [ ] **Step 2.3: Add keys to he.json**

Same five keys, Hebrew translations:

```json
"newPayment": "תשלום חדש",
"from": "מאת",
"to": "אל",
"swap": "החלף",
"method": "אמצעי תשלום",
"recordPaymentWithAmount": "רשום תשלום · {{currencyAndAmount}}"
```

- [ ] **Step 2.4: Validate JSON**

Run: `cd cost-share-app/apps/mobile && node -e "JSON.parse(require('fs').readFileSync('i18n/locales/en.json'));JSON.parse(require('fs').readFileSync('i18n/locales/he.json'));console.log('ok')"`
Expected: `ok`. If it errors, fix the trailing-comma mistake.

- [ ] **Step 2.5: Commit**

```bash
git add cost-share-app/apps/mobile/i18n/locales/en.json cost-share-app/apps/mobile/i18n/locales/he.json
git commit -m "$(cat <<'EOF'
i18n(mobile): add settle-up popup keys (newPayment, from, to, swap, method, recordPaymentWithAmount)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Build `BottomSheetShell`

A reusable wrapper containing scrim + sheet container + drag handle + header row. Sibling sheets (`SettlementDetailSheet`) will adopt this later.

**Files:**
- Create: `cost-share-app/apps/mobile/components/BottomSheetShell.tsx`
- Test: `cost-share-app/apps/mobile/__tests__/components/BottomSheetShell.test.tsx`

- [ ] **Step 3.1: Write the failing tests first**

Create `__tests__/components/BottomSheetShell.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BottomSheetShell } from '../../components/BottomSheetShell';

describe('BottomSheetShell', () => {
    const baseProps = {
        visible: true,
        label: 'SETTLE UP',
        onClose: jest.fn(),
        onSave: jest.fn(),
        saveDisabled: false,
    };

    beforeEach(() => jest.clearAllMocks());

    it('renders the label and children when visible', () => {
        const { getByText } = render(
            <BottomSheetShell {...baseProps}>
                <Text>body</Text>
            </BottomSheetShell>
        );
        expect(getByText('SETTLE UP')).toBeTruthy();
        expect(getByText('body')).toBeTruthy();
    });

    it('calls onClose when Cancel is pressed', () => {
        const onClose = jest.fn();
        const { getByText } = render(
            <BottomSheetShell {...baseProps} onClose={onClose}>
                <Text>x</Text>
            </BottomSheetShell>
        );
        fireEvent.press(getByText('Cancel'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onSave when Save is pressed', () => {
        const onSave = jest.fn();
        const { getByText } = render(
            <BottomSheetShell {...baseProps} onSave={onSave}>
                <Text>x</Text>
            </BottomSheetShell>
        );
        fireEvent.press(getByText('Save'));
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('disables Save when saveDisabled is true', () => {
        const onSave = jest.fn();
        const { getByText } = render(
            <BottomSheetShell {...baseProps} onSave={onSave} saveDisabled>
                <Text>x</Text>
            </BottomSheetShell>
        );
        fireEvent.press(getByText('Save'));
        expect(onSave).not.toHaveBeenCalled();
    });

    it('calls onClose when scrim is tapped', () => {
        const onClose = jest.fn();
        const { getByTestId } = render(
            <BottomSheetShell {...baseProps} onClose={onClose}>
                <Text>x</Text>
            </BottomSheetShell>
        );
        fireEvent.press(getByTestId('bottom-sheet-scrim'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 3.2: Run tests; confirm failure**

Run: `cd cost-share-app/apps/mobile && npm test -- __tests__/components/BottomSheetShell.test.tsx`
Expected: FAIL with `Cannot find module '../../components/BottomSheetShell'`.

- [ ] **Step 3.3: Implement the component**

Create `components/BottomSheetShell.tsx`:

```tsx
/**
 * BottomSheetShell — reusable bottom-sheet wrapper.
 * Provides: scrim, sheet container (62% height, rounded top, sheet shadow),
 * drag handle, header row (Cancel · uppercase label · Save), hairline divider.
 * Children render in a scrollable body below the header.
 */
import React from 'react';
import {
    Modal,
    Pressable,
    View,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './AppText';

interface BottomSheetShellProps {
    visible: boolean;
    label: string;
    onClose: () => void;
    onSave?: () => void;
    saveDisabled?: boolean;
    children: React.ReactNode;
}

export function BottomSheetShell({
    visible,
    label,
    onClose,
    onSave,
    saveDisabled = false,
    children,
}: BottomSheetShellProps) {
    const { t } = useTranslation();
    const { height } = useWindowDimensions();
    const sheetHeight = Math.round(height * 0.62);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}>
                <Pressable
                    testID="bottom-sheet-scrim"
                    onPress={onClose}
                    className="absolute inset-0"
                />
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View
                        style={{
                            height: sheetHeight,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: -8 },
                            shadowOpacity: 0.18,
                            shadowRadius: 24,
                            elevation: 24,
                        }}
                        className="bg-white rounded-t-3xl overflow-hidden"
                    >
                        <View className="items-center pt-2">
                            <View className="w-10 h-1 rounded-full bg-gray-200" />
                        </View>
                        <View className="flex-row items-center justify-between px-4 py-3">
                            <Pressable onPress={onClose} hitSlop={8}>
                                <Text className="text-[15px] font-medium text-gray-600">
                                    {t('common.cancel')}
                                </Text>
                            </Pressable>
                            <Text
                                className="text-xs font-semibold text-gray-500 uppercase"
                                style={{ letterSpacing: 0.06 * 12 }}
                            >
                                {label}
                            </Text>
                            <Pressable
                                onPress={() => { if (!saveDisabled && onSave) onSave(); }}
                                hitSlop={8}
                                disabled={saveDisabled}
                            >
                                <Text
                                    className={
                                        saveDisabled
                                            ? 'text-[15px] font-bold text-gray-300'
                                            : 'text-[15px] font-bold text-primary-dark'
                                    }
                                >
                                    {t('common.save')}
                                </Text>
                            </Pressable>
                        </View>
                        <View className="h-px bg-border-soft" />
                        <View className="flex-1">{children}</View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}
```

- [ ] **Step 3.4: Run tests; confirm pass**

Run: `cd cost-share-app/apps/mobile && npm test -- __tests__/components/BottomSheetShell.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 3.5: Commit**

```bash
git add cost-share-app/apps/mobile/components/BottomSheetShell.tsx cost-share-app/apps/mobile/__tests__/components/BottomSheetShell.test.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add BottomSheetShell — reusable scrim+header bottom-sheet wrapper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extend `SettleUpFormValues` and update call sites

The current `SettleUpFormValues` has `fromUserId, toUserId, currency, amount`. The new design surfaces `paymentMethod` and `settlementDate` to the user, so they must be in the submitted payload and forwarded to `createSettlement`.

**Files:**
- Modify: `cost-share-app/apps/mobile/components/SettleUpSheet.tsx` (interface only; rewrite happens in Task 5)
- Modify: `cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx`
- Modify: `cost-share-app/apps/mobile/screens/balances/SettleUpListScreen.tsx`
- Modify: `cost-share-app/apps/mobile/screens/balances/BalancesScreen.tsx`

- [ ] **Step 4.1: Find the `PaymentMethod` enum**

Run: `cd cost-share-app/apps/mobile && grep -rn "PaymentMethod\|paymentMethod" packages/shared/src/ services/settlements.service.ts | head -20`
Expected: locate the existing `PaymentMethod` literal type (likely `'cash' | 'bank_transfer' | 'paypal' | 'venmo' | 'credit_card' | 'other'`). Note its exact form and which module exports it. If the enum is in `@cost-share/shared`, import from there.

- [ ] **Step 4.2: Update the `SettleUpFormValues` interface**

In `components/SettleUpSheet.tsx`, change the interface (top of file) to:

```ts
import type { PaymentMethod } from '@cost-share/shared'; // adjust to the path Step 4.1 found

export interface SettleUpFormValues {
    fromUserId: string;
    toUserId: string;
    currency: string;
    amount: number;
    paymentMethod: PaymentMethod;
    settlementDate: Date;
}
```

> If `PaymentMethod` is not exported from `@cost-share/shared`, define it inline in this file as `export type PaymentMethod = 'cash' | 'bank_transfer' | 'paypal' | 'other';` (and remove the import). The four-method picker only needs these four — the service already accepts string.

- [ ] **Step 4.3: Update the three call sites' `onSubmit` handlers**

For each of the three call sites — `GroupDetailScreen.tsx:872`, `SettleUpListScreen.tsx:317` / `:358`, `BalancesScreen.tsx:271` — find the `onSubmit` callback they pass and forward the two new fields to `createSettlement`. Example shape:

```tsx
onSubmit={async (values) => {
    await createSettlementMutation.mutateAsync({
        groupId,
        fromUserId: values.fromUserId,
        toUserId: values.toUserId,
        amount: values.amount,
        currency: values.currency,
        paymentMethod: values.paymentMethod,
        settlementDate: values.settlementDate,
    });
    setSettleUpVisible(false);
}}
```

For the `edit` mode in `GroupDetailScreen.tsx` (line 858–874), forward to `updateSettlementMutation` instead. Confirm `UpdateSettlementDto` accepts `paymentMethod` and `settlementDate` (run `grep -n UpdateSettlementDto packages/shared/src/`); if not, this task is **complete** for create-mode only — flag the edit-mode caller as needing a follow-up plan (do not silently drop the new fields).

- [ ] **Step 4.4: Type check**

Run: `cd cost-share-app/apps/mobile && npx tsc --noEmit`
Expected: PASS. Errors here are real — fix them inline.

- [ ] **Step 4.5: Commit**

```bash
git add cost-share-app/apps/mobile/components/SettleUpSheet.tsx cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx cost-share-app/apps/mobile/screens/balances/SettleUpListScreen.tsx cost-share-app/apps/mobile/screens/balances/BalancesScreen.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): extend SettleUpFormValues with paymentMethod + settlementDate

Plumbs the two new fields from the sheet through every call site into
createSettlement / updateSettlement. Sheet body still uses the old layout —
the visual rewrite ships in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Rewrite `SettleUpSheet` body — hero, method tiles, bottom dock

This is the visual rewrite. Three local sub-components inside `SettleUpSheet.tsx` (one file, easier to read top-to-bottom and matches the existing codebase pattern).

**Files:**
- Modify (rewrite body of): `cost-share-app/apps/mobile/components/SettleUpSheet.tsx`
- Test: `cost-share-app/apps/mobile/__tests__/components/SettleUpSheet.test.tsx`

### 5a — Hero sub-component (top of file, above the main export)

- [ ] **Step 5.1: Write failing tests for the sheet contract**

Create `__tests__/components/SettleUpSheet.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettleUpSheet, SettleUpFormValues } from '../../components/SettleUpSheet';
import type { GroupMemberLite, PairwiseDebt } from '@cost-share/shared';

const members: GroupMemberLite[] = [
    { userId: 'u1', displayName: 'You', avatarUrl: null } as GroupMemberLite,
    { userId: 'u2', displayName: 'David', avatarUrl: null } as GroupMemberLite,
];
const debts: PairwiseDebt[] = [
    { fromUserId: 'u1', toUserId: 'u2', currency: 'USD', amount: 18 } as PairwiseDebt,
];
const baseInitial = {
    fromUserId: 'u1',
    toUserId: 'u2',
    currency: 'USD',
    amount: 18,
};

const renderSheet = (overrides: Partial<React.ComponentProps<typeof SettleUpSheet>> = {}) =>
    render(
        <SettleUpSheet
            visible
            members={members}
            pairwiseDebts={debts}
            currentUserId="u1"
            initial={baseInitial}
            mode="create"
            onClose={jest.fn()}
            onSubmit={jest.fn()}
            {...overrides}
        />
    );

describe('SettleUpSheet (redesign)', () => {
    it('pre-fills amount, currency, and from/to from initial', () => {
        const { getByText } = renderSheet();
        expect(getByText('18.00')).toBeTruthy();
        expect(getByText('USD')).toBeTruthy();
        expect(getByText('You')).toBeTruthy();
        expect(getByText('David')).toBeTruthy();
    });

    it('SWAP chip flips from/to and submits the swapped payload', async () => {
        const onSubmit = jest.fn();
        const { getByText, getByTestId } = renderSheet({ onSubmit });
        fireEvent.press(getByText('Swap'));
        fireEvent.press(getByTestId('settle-record-button'));
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ fromUserId: 'u2', toUserId: 'u1' })
        );
    });

    it('selecting a method tile updates the submitted paymentMethod', async () => {
        const onSubmit = jest.fn();
        const { getByTestId } = renderSheet({ onSubmit });
        fireEvent.press(getByTestId('method-tile-paypal'));
        fireEvent.press(getByTestId('settle-record-button'));
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ paymentMethod: 'paypal' })
        );
    });

    it('defaults paymentMethod to bank_transfer per design', async () => {
        const onSubmit = jest.fn();
        const { getByTestId } = renderSheet({ onSubmit });
        fireEvent.press(getByTestId('settle-record-button'));
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ paymentMethod: 'bank_transfer' })
        );
    });

    it('disables Record payment when amount is zero', () => {
        const onSubmit = jest.fn();
        const { getByTestId } = renderSheet({
            initial: { ...baseInitial, amount: 0 },
            onSubmit,
        });
        fireEvent.press(getByTestId('settle-record-button'));
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('record button label includes the formatted amount', () => {
        const { getByText } = renderSheet();
        expect(getByText(/Record payment · USD 18\.00/)).toBeTruthy();
    });
});
```

- [ ] **Step 5.2: Run tests; confirm failure**

Run: `cd cost-share-app/apps/mobile && npm test -- __tests__/components/SettleUpSheet.test.tsx`
Expected: FAIL (tests will likely error on missing testIDs and on old sheet rendering instead of the new layout).

- [ ] **Step 5.3: Install `expo-linear-gradient` if not present**

Run: `cd cost-share-app/apps/mobile && node -e "require('expo-linear-gradient')" 2>&1 | head -5`
If module-not-found: `npx expo install expo-linear-gradient` (uses Expo SDK 55-compatible version). Otherwise skip.

- [ ] **Step 5.4: Rewrite `SettleUpSheet.tsx`**

Overwrite the entire file with:

```tsx
/**
 * SettleUpSheet — bottom-sheet form for recording / editing a settlement.
 * Design: docs/design_handoff_settle/README.md.
 *
 * Layout:
 *   ┌ Cancel · SETTLE UP · Save ────────────┐  (BottomSheetShell header)
 *   │ Emerald hero: From → amount → To       │
 *   │ Method tiles (Cash · Bank · PP · Other)│
 *   │ Date chip + "Record payment · USD X.XX"│  (bottom dock)
 *   └────────────────────────────────────────┘
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Pressable, TextInput, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { GroupMemberLite, PairwiseDebt, PaymentMethod } from '@cost-share/shared';
import { Text } from './AppText';
import { MemberAvatar } from './MemberAvatar';
import { AppIcon } from './AppIcon';
import { BottomSheetShell } from './BottomSheetShell';
import { useRtlLayout } from '../hooks/useRtlLayout';
import { getAvatarUrlForMember } from '../lib/userDisplay';

export interface SettleUpFormValues {
    fromUserId: string;
    toUserId: string;
    currency: string;
    amount: number;
    paymentMethod: PaymentMethod;
    settlementDate: Date;
}

interface SettleUpSheetProps {
    visible: boolean;
    members: GroupMemberLite[];
    pairwiseDebts: PairwiseDebt[];
    currentUserId: string;
    initial: {
        fromUserId: string;
        toUserId: string;
        currency: string;
        amount: number;
        paymentMethod?: PaymentMethod;
        settlementDate?: Date;
    };
    groupName?: string;
    mode: 'create' | 'edit';
    submitting?: boolean;
    onSubmit: (values: SettleUpFormValues) => Promise<void> | void;
    onClose: () => void;
}

type MethodKey = Extract<PaymentMethod, 'cash' | 'bank_transfer' | 'paypal' | 'other'>;

const METHOD_TILES: ReadonlyArray<{ key: MethodKey; icon: string }> = [
    { key: 'cash', icon: 'cash-outline' },
    { key: 'bank_transfer', icon: 'card-outline' },
    { key: 'paypal', icon: 'logo-paypal' },
    { key: 'other', icon: 'ellipsis-horizontal' },
];

const formatAmountText = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '');
const formatShortDate = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: undefined, month: 'short', day: 'numeric' });

export function SettleUpSheet({
    visible,
    members,
    pairwiseDebts: _pairwiseDebts,
    currentUserId: _currentUserId,
    initial,
    groupName,
    mode,
    submitting = false,
    onSubmit,
    onClose,
}: SettleUpSheetProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    const [fromUserId, setFromUserId] = useState(initial.fromUserId);
    const [toUserId, setToUserId] = useState(initial.toUserId);
    const [currency, setCurrency] = useState(initial.currency);
    const [amountText, setAmountText] = useState(formatAmountText(initial.amount));
    const [paymentMethod, setPaymentMethod] = useState<MethodKey>(
        (initial.paymentMethod as MethodKey | undefined) ?? 'bank_transfer'
    );
    const [settlementDate, setSettlementDate] = useState<Date>(
        initial.settlementDate ?? new Date()
    );
    const [datePickerOpen, setDatePickerOpen] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setFromUserId(initial.fromUserId);
        setToUserId(initial.toUserId);
        setCurrency(initial.currency);
        setAmountText(formatAmountText(initial.amount));
        setPaymentMethod((initial.paymentMethod as MethodKey | undefined) ?? 'bank_transfer');
        setSettlementDate(initial.settlementDate ?? new Date());
    }, [
        visible,
        initial.fromUserId,
        initial.toUserId,
        initial.currency,
        initial.amount,
        initial.paymentMethod,
        initial.settlementDate,
    ]);

    const parsedAmount = useMemo(() => {
        const n = parseFloat(amountText.replace(',', '.'));
        return Number.isFinite(n) ? n : NaN;
    }, [amountText]);

    const memberById = useMemo(() => {
        const map = new Map<string, GroupMemberLite>();
        members.forEach(m => map.set(m.userId, m));
        return map;
    }, [members]);

    const fromMember = memberById.get(fromUserId);
    const toMember = memberById.get(toUserId);

    const recordDisabled =
        submitting || !Number.isFinite(parsedAmount) || parsedAmount <= 0;

    const handleSwap = useCallback(() => {
        setFromUserId(prevFrom => {
            setToUserId(prevFrom);
            return toUserId;
        });
    }, [toUserId]);

    const handleSubmit = useCallback(async () => {
        if (recordDisabled) return;
        await onSubmit({
            fromUserId,
            toUserId,
            currency,
            amount: Number(parsedAmount.toFixed(2)),
            paymentMethod,
            settlementDate,
        });
    }, [
        recordDisabled,
        onSubmit,
        fromUserId,
        toUserId,
        currency,
        parsedAmount,
        paymentMethod,
        settlementDate,
    ]);

    const label = mode === 'edit' ? t('settleUp.edit') : t('settleUp.title');
    const formattedAmountForButton = Number.isFinite(parsedAmount)
        ? `${currency} ${parsedAmount.toFixed(2)}`
        : `${currency} 0.00`;

    return (
        <BottomSheetShell
            visible={visible}
            label={label}
            onClose={onClose}
            onSave={handleSubmit}
            saveDisabled={recordDisabled}
        >
            <View className="flex-1">
                <SettleUpHero
                    fromMember={fromMember}
                    toMember={toMember}
                    currency={currency}
                    amountText={amountText}
                    onAmountChange={setAmountText}
                    onSwap={handleSwap}
                    groupName={groupName}
                    isRtl={isRtl}
                />

                <View className="px-4 pt-5">
                    <Text
                        className="text-[9px] font-bold text-gray-400 uppercase mb-2"
                        style={{ letterSpacing: 0.06 * 9 }}
                    >
                        {t('settleUp.method')}
                    </Text>
                    <MethodTiles
                        selected={paymentMethod}
                        onSelect={setPaymentMethod}
                        t={t}
                    />
                </View>

                <SettleUpBottomDock
                    settlementDate={settlementDate}
                    onOpenDatePicker={() => setDatePickerOpen(true)}
                    onRecord={handleSubmit}
                    recordDisabled={recordDisabled}
                    label={t('settleUp.recordPaymentWithAmount', {
                        currencyAndAmount: formattedAmountForButton,
                    })}
                />

                {datePickerOpen && (
                    <DateTimePicker
                        value={settlementDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        onChange={(_, date) => {
                            setDatePickerOpen(false);
                            if (date) setSettlementDate(date);
                        }}
                    />
                )}
            </View>
        </BottomSheetShell>
    );
}

/* ----- Hero ---------------------------------------------------------------- */

interface SettleUpHeroProps {
    fromMember: GroupMemberLite | undefined;
    toMember: GroupMemberLite | undefined;
    currency: string;
    amountText: string;
    onAmountChange: (v: string) => void;
    onSwap: () => void;
    groupName?: string;
    isRtl: boolean;
}

function SettleUpHero({
    fromMember,
    toMember,
    currency,
    amountText,
    onAmountChange,
    onSwap,
    groupName,
    isRtl,
}: SettleUpHeroProps) {
    const { t } = useTranslation();
    return (
        <View className="mx-4 mt-3 rounded-2xl overflow-hidden border border-success-border">
            <LinearGradient
                colors={['#10B981', '#047857']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ height: 196 }}
            >
                <View className="flex-row items-center justify-between px-3 pt-2">
                    <View
                        className="flex-row items-center px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                    >
                        <AppIcon name="checkmark-circle" size={12} color="#FFFFFF" />
                        <Text className="text-white text-[11px] font-semibold ml-1">
                            {t('settleUp.newPayment')}
                        </Text>
                    </View>
                    {groupName ? (
                        <Text
                            className="text-[11px] font-medium"
                            style={{
                                color: 'rgba(255,255,255,0.92)',
                                textShadowColor: 'rgba(0,0,0,0.4)',
                                textShadowOffset: { width: 0, height: 1 },
                                textShadowRadius: 2,
                            }}
                            numberOfLines={1}
                        >
                            {groupName}
                        </Text>
                    ) : null}
                </View>

                <View className="flex-1 flex-row items-center justify-between px-3">
                    <FlowAvatar member={fromMember} label={t('settleUp.from')} />

                    <View className="flex-1 items-center">
                        <Pressable
                            className="flex-row items-baseline rounded-xl px-3 py-1"
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.14)',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.32)',
                            }}
                        >
                            <Text
                                className="text-[11px] font-bold mr-1.5"
                                style={{
                                    color: 'rgba(255,255,255,0.78)',
                                    letterSpacing: 0.04 * 11,
                                }}
                            >
                                {currency}
                            </Text>
                            <AppIcon name="chevron-down" size={10} color="rgba(255,255,255,0.78)" />
                            <TextInput
                                value={amountText}
                                onChangeText={onAmountChange}
                                keyboardType="decimal-pad"
                                selectionColor="#FFFFFF"
                                style={{
                                    color: '#FFFFFF',
                                    fontSize: 26,
                                    fontWeight: '700',
                                    fontVariant: ['tabular-nums'],
                                    letterSpacing: -0.02 * 26,
                                    marginLeft: 6,
                                    minWidth: 80,
                                    padding: 0,
                                    textAlign: 'center',
                                }}
                                testID="settle-amount-input"
                            />
                        </Pressable>

                        <View className="flex-row items-center mt-2 w-3/4">
                            <View className="flex-1 h-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }} />
                            <AppIcon
                                name={isRtl ? 'chevron-back' : 'chevron-forward'}
                                size={18}
                                color="rgba(255,255,255,0.95)"
                            />
                        </View>

                        <Pressable
                            onPress={onSwap}
                            className="flex-row items-center mt-2 rounded-full px-2 py-0.5"
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.18)',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.35)',
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t('settleUp.swap')}
                        >
                            <AppIcon name="swap-horizontal-outline" size={11} color="#FFFFFF" />
                            <Text className="text-white text-[10px] font-bold ml-1">
                                {t('settleUp.swap')}
                            </Text>
                        </Pressable>
                    </View>

                    <FlowAvatar member={toMember} label={t('settleUp.to')} />
                </View>
            </LinearGradient>
        </View>
    );
}

function FlowAvatar({ member, label }: { member: GroupMemberLite | undefined; label: string }) {
    return (
        <View style={{ width: 96 }} className="items-center">
            <View
                style={{
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    borderRadius: 999,
                    shadowColor: '#FFFFFF',
                    shadowOpacity: 0.25,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 0 },
                }}
            >
                <MemberAvatar
                    name={member?.displayName ?? '?'}
                    avatarUrl={getAvatarUrlForMember(member)}
                    pixelSize={44}
                />
            </View>
            <Text
                className="text-[13px] font-bold text-white mt-1"
                style={{
                    textShadowColor: 'rgba(0,0,0,0.35)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                }}
                numberOfLines={1}
            >
                {member?.displayName ?? ''}
            </Text>
            <Text
                className="text-[9px] font-bold uppercase mt-0.5"
                style={{ color: 'rgba(255,255,255,0.8)', letterSpacing: 0.08 * 9 }}
            >
                {label}
            </Text>
        </View>
    );
}

/* ----- Method tiles -------------------------------------------------------- */

interface MethodTilesProps {
    selected: MethodKey;
    onSelect: (m: MethodKey) => void;
    t: (key: string) => string;
}

function MethodTiles({ selected, onSelect, t }: MethodTilesProps) {
    return (
        <View className="flex-row" style={{ gap: 10 }}>
            {METHOD_TILES.map(({ key, icon }) => {
                const isSelected = key === selected;
                return (
                    <Pressable
                        key={key}
                        onPress={() => onSelect(key)}
                        testID={`method-tile-${key}`}
                        accessibilityRole="button"
                        accessibilityLabel={t(`settlements.methods.${key}`)}
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                        }}
                        className={
                            isSelected
                                ? 'bg-primary-extra-light border-primary-light'
                                : 'bg-white border-border-card'
                        }
                    >
                        <AppIcon
                            name={icon as any}
                            size={22}
                            color={isSelected ? '#3B82F6' : '#374151'}
                        />
                    </Pressable>
                );
            })}
        </View>
    );
}

/* ----- Bottom dock --------------------------------------------------------- */

interface SettleUpBottomDockProps {
    settlementDate: Date;
    onOpenDatePicker: () => void;
    onRecord: () => void;
    recordDisabled: boolean;
    label: string;
}

function SettleUpBottomDock({
    settlementDate,
    onOpenDatePicker,
    onRecord,
    recordDisabled,
    label,
}: SettleUpBottomDockProps) {
    return (
        <View
            className="absolute left-0 right-0 bottom-0 bg-white/95 border-t border-border-soft"
            style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22 }}
        >
            <View className="items-center mb-2">
                <Pressable
                    onPress={onOpenDatePicker}
                    className="flex-row items-center bg-white border border-border-card rounded-full px-3 py-1"
                    style={{
                        shadowColor: '#000',
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        shadowOffset: { width: 0, height: 1 },
                    }}
                    accessibilityRole="button"
                    testID="settle-date-chip"
                >
                    <AppIcon name="calendar-outline" size={13} color="#4B5563" />
                    <Text className="text-[12px] font-semibold text-gray-500 mx-1.5">
                        {formatShortDate(settlementDate)}
                    </Text>
                    <AppIcon name="chevron-down" size={11} color="#6B7280" />
                </Pressable>
            </View>

            <Pressable
                onPress={onRecord}
                disabled={recordDisabled}
                testID="settle-record-button"
                className={
                    recordDisabled
                        ? 'flex-row items-center justify-center rounded-2xl bg-gray-200 px-5 py-3.5'
                        : 'flex-row items-center justify-center rounded-2xl bg-primary px-5 py-3.5'
                }
                style={
                    recordDisabled
                        ? undefined
                        : {
                              shadowColor: '#3B82F6',
                              shadowOpacity: 0.35,
                              shadowRadius: 16,
                              shadowOffset: { width: 0, height: 6 },
                          }
                }
            >
                <AppIcon
                    name="checkmark-circle"
                    size={20}
                    color={recordDisabled ? '#9CA3AF' : '#FFFFFF'}
                />
                <Text
                    className={
                        recordDisabled
                            ? 'text-[16px] font-bold text-gray-400 ml-2'
                            : 'text-[16px] font-bold text-white ml-2'
                    }
                >
                    {label}
                </Text>
            </Pressable>
        </View>
    );
}
```

- [ ] **Step 5.5: Run tests; confirm pass**

Run: `cd cost-share-app/apps/mobile && npm test -- __tests__/components/SettleUpSheet.test.tsx`
Expected: PASS (6 tests). Iterate if anything fails — common causes: import path for `PaymentMethod`, missing `expo-linear-gradient`, jest mock for `@react-native-community/datetimepicker`.

> If `@react-native-community/datetimepicker` isn't installed, run `npx expo install @react-native-community/datetimepicker` and add a jest mock at the top of the test file:
> ```ts
> jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
> ```

- [ ] **Step 5.6: Type check + lint**

Run: `cd cost-share-app/apps/mobile && npx tsc --noEmit && npm run lint`
Expected: both PASS. Fix any errors before committing.

- [ ] **Step 5.7: Commit**

```bash
git add cost-share-app/apps/mobile/components/SettleUpSheet.tsx cost-share-app/apps/mobile/__tests__/components/SettleUpSheet.test.tsx cost-share-app/apps/mobile/package.json cost-share-app/apps/mobile/package-lock.json
git commit -m "$(cat <<'EOF'
feat(mobile): redesign SettleUpSheet to match settle-up handoff

Implements the emerald-gradient hero with From → editable amount → To flow,
4-tile method picker (cash, bank, paypal, other), centered date chip, and
"Record payment · CCY X.XX" primary button. Reuses BottomSheetShell.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Manual smoke test in the app

UI changes need real-app verification. The mobile AGENTS.md requires dev Supabase env (`drxfbicunusmipdgbgdk`) — confirm before starting.

- [ ] **Step 6.1: Confirm dev Supabase env**

Run: `cd cost-share-app/apps/mobile && grep EXPO_PUBLIC_SUPABASE_URL .env | head -1`
Expected: a URL containing `drxfbicunusmipdgbgdk`. If it points to `jfqxjjjbpxbwwvoygahu` (prod), STOP and ask the user — do not run the app against prod.

- [ ] **Step 6.2: Start the app**

Run: `cd cost-share-app/apps/mobile && npm start` (or use `/run` skill which knows project conventions).

- [ ] **Step 6.3: Walk the golden path**

1. Open a group with at least one outstanding balance.
2. Tap **Settle Up** on the group summary card.
3. Confirm the sheet opens at ~62% height, shows scrim, has the drag handle and `Cancel · SETTLE UP · Save` header.
4. Confirm the hero shows From avatar → amount → To avatar, with the amount pre-filled from the balance.
5. Tap amount, edit it. Tap `USD ⌄` (just verifying the area is tappable; full picker is out of scope here unless wired in this task).
6. Tap **Swap** — From / To swap.
7. Tap each method tile; confirm the selected state visually changes; `bank_transfer` is the default.
8. Tap the date chip — date picker opens; pick a date.
9. Tap **Record payment · USD X.XX**. Confirm:
   - sheet dismisses,
   - "Payment recorded" toast appears,
   - the balance updates on the group screen.
10. Re-open and tap the scrim (above the sheet) — sheet dismisses.
11. Re-open and tap **Cancel** — sheet dismisses without recording.

- [ ] **Step 6.4: Walk one RTL edge case**

Toggle the app to Hebrew (`he`). Reopen the sheet. Confirm: Cancel/Save swap sides, From/To columns mirror, arrow chevron points the other way. Take a screenshot for the PR description.

- [ ] **Step 6.5: Record findings**

If anything looks wrong, do NOT mark this task complete. File the specific issue (component / line / what's off), and either fix it in this task or open a follow-up in `docs/superpowers/plans/`.

- [ ] **Step 6.6: Commit any polish from smoke test**

```bash
git status
# If any tweaks were made:
git add -p
git commit -m "$(cat <<'EOF'
fix(mobile): settle-up popup polish from smoke test

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Open the PR

- [ ] **Step 7.1: Push and open PR**

Run:

```bash
git push -u origin settlement-popup-redesign
gh pr create --title "Redesign Settle-Up popup per 2026-05-26 handoff" --body "$(cat <<'EOF'
## Summary
- Rewrites `SettleUpSheet` to match `docs/design_handoff_settle/README.md`: emerald hero with From → editable amount → To, currency + swap chip, 4 method tiles, date chip, "Record payment · CCY X.XX" button.
- Extracts reusable `BottomSheetShell` (scrim, drag handle, Cancel/Save header).
- Adds theme tokens (`success.border`, `border.soft`, `border.card`, `shadow-fab`, `shadow-sheet`) and i18n keys (`settleUp.{newPayment,from,to,swap,method,recordPaymentWithAmount}`).
- Extends `SettleUpFormValues` with `paymentMethod` + `settlementDate`; updates the three call sites.

## Test plan
- [x] Unit: `npm test -- __tests__/components/SettleUpSheet.test.tsx` (6 cases)
- [x] Unit: `npm test -- __tests__/components/BottomSheetShell.test.tsx` (5 cases)
- [x] Type check: `npx tsc --noEmit`
- [x] Manual: golden path + RTL smoke (see screenshots)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Spec coverage check

| Spec section | Covered by |
|---|---|
| Sheet container (62%, rounded top, scrim, drag handle, sheet shadow) | Task 3 |
| Header row (Cancel · SETTLE UP · Save · hairline) | Task 3 |
| Hero container (emerald gradient, success-border) | Task 1 (tokens) + Task 5 |
| Hero top chrome ("New payment" pill, group name) | Task 5 (uses `groupName` prop) |
| FlowAvatar (44px, white border, glow, name, FROM/TO labels) | Task 5 |
| Editable amount + currency chevron | Task 5 |
| Arrow + SWAP chip (RTL-aware chevron flip) | Task 5 (uses `useRtlLayout`) |
| Method tiles (4 tiles, bank_transfer default) | Task 5 (+ tests cover default + selection) |
| Bottom dock (date chip + primary button) | Task 5 |
| Dismiss via scrim / Cancel / Save | Task 3 (+ Task 6 smoke test) |
| `createSettlement` call with method + date | Task 4 (plumbing) + Task 5 (form values) |
| i18n keys | Task 2 |
| RTL | Task 5 (chevron flip), Task 6 (smoke) |
| Tests | Tasks 3, 5 |

## Out of scope (file a follow-up, do not implement here)

- Currency picker UI (`USD ⌄` tap surface is present but opens nothing yet). The handoff allows for a follow-up.
- "Other" method expanding into Venmo / credit card list.
- Numeric in-sheet keypad (we use the system decimal keypad).
- Sheet shared with `SettlementDetailSheet` — `BottomSheetShell` is built to allow this, but the detail-sheet refactor is a separate plan.
