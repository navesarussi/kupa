# Settle Up — v1 Plan

Status: planning · Owner: Avi · Last updated: 2026-05-20

The current `SettleUpScreen` is being thrown away. This document plans a new Settle Up feature from scratch.

---

## 1. Goals & non-goals

**In scope (v1)**
- Per-group settlement (no cross-group settling).
- Suggest the minimal set of payments that clears the group, **per currency, independently**.
- Record a payment between two members; it adjusts group balances.
- Multi-currency: balances stay separate per currency code — no FX conversion.
- Partial payments allowed; warn if the entered amount doesn't fully clear the suggested debt (or overshoots).
- Either party (payer or receiver) can edit/delete a settlement at any time.
- The other party is notified in-app (in-app inbox + badge — no push, no email).
- Settlement shows up in the group's feed as a distinct "payment" entry.

**Out of scope (v1)**
- Dispute flow (edit/delete + notification is the dispute mechanism).
- Payment provider integration (Bit, PayBox, bank transfer link).
- Push notifications.
- Cross-group / per-friend aggregate settling.
- FX conversion between currencies.

---

## 2. Data model

### `settlements` (existing table — add fields)
File: [cost-share-app/supabase/schema.sql](../cost-share-app/supabase/schema.sql) (line 93)

Already has: `id`, `group_id`, `from_user_id`, `to_user_id`, `amount`, `currency`, `payment_method`, `settlement_date`, `created_by`.

Add:
- `note TEXT NULL` — optional memo.
- `updated_at TIMESTAMPTZ` — for edit tracking.
- `deleted_at TIMESTAMPTZ NULL` — soft delete (excluded from balance math but kept in history).

**RLS:** both `from_user_id` and `to_user_id` may `UPDATE` and (soft-)`DELETE`. Group members may `SELECT`.

### `notifications` (new table)
No notification system exists today. Create:

```
notifications
  id                  UUID PK
  recipient_user_id   UUID  -- who sees this
  actor_user_id       UUID  -- who triggered it
  type                TEXT  -- 'settlement_created' | 'settlement_updated' | 'settlement_deleted'
  group_id            UUID
  settlement_id       UUID  -- nullable (settlement may be hard-deleted later)
  payload             JSONB -- snapshot: { amount, currency, from, to, prev_amount? }
  is_read             BOOL  default false
  created_at          TIMESTAMPTZ default now()
```

**Trigger** on `settlements` insert/update/delete: insert one notification for the counterparty (the user who is NOT the `actor`, where `actor = current_user`).

---

## 3. Balance + suggestion algorithm

Per group, **per currency, independently**:

1. For each member, compute net balance in that currency:
   `net = sum(expenses they paid) − sum(expense splits they owe) + sum(settlements received) − sum(settlements sent)`
   (excluding soft-deleted expenses/settlements)
2. Greedy min-cash-flow:
   - Separate members into creditors (`net > 0`) and debtors (`net < 0`).
   - Repeatedly match the largest creditor with the largest debtor for `min(|c|, |d|)`, append to the suggestion list, zero out whichever side hits 0 first.
   - Continue until all balances are zero (modulo a small epsilon).
3. Return per-currency suggestions.

**New RPC:** `get_group_settle_suggestions(p_group_id UUID)`
Returns:
```
[
  { currency: 'ILS', suggestions: [{ from_user_id, to_user_id, amount }, ...] },
  { currency: 'USD', suggestions: [...] },
  ...
]
```
Reuse the per-group/per-currency CTEs that already exist in `get_user_dashboard` (schema.sql:273).

---

## 4. UI surfaces

### A. Group Detail — inline Balances section (new)
File: [cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx](../cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx)

Sits between `QuickActionsRow` and the feed. One card per currency:
- If balanced: "All settled up in ₪".
- Otherwise: list of "Avi → Dana ₪50 · [Settle]" rows.

Tapping `[Settle]` opens the Settle Up sheet pre-filled with that pair, amount, and currency.

### B. Group Detail — "Settle up" Quick Action (rewire existing)
The Quick Action button stays where it is in `QuickActionsRow`, but now opens the Settle Up sheet in **blank mode** (user picks everything manually). No more navigation to the old screen.

### C. Settle Up bottom sheet (new — replaces old `SettleUpScreen`)
Bottom sheet, not a full screen. Fields:
- **Payer** (member picker) — pre-filled from suggestion if launched that way.
- **Receiver** (member picker) — pre-filled from suggestion if launched that way.
- **Amount** — pre-filled from suggestion; freely editable.
- **Currency** — defaults to group's `default_currency`; selectable from currencies that appear in the group's balances.
- **Date** — defaults to today; pickable.
- **Payment method** — optional (uses existing enum: cash, bank_transfer, venmo, paypal, credit_card, other).
- **Note** — optional free text.

Warnings (inline, non-blocking):
- If amount < suggested debt for that pair+currency: *"This leaves ₪X still owed."*
- If amount > suggested debt: *"This is more than what's owed — the remainder will flip the balance."*

Submit → insert into `settlements` → trigger inserts notification for counterparty → close sheet → balances section + feed refresh.

### D. Settlement in the group feed
File: [cost-share-app/apps/mobile/types/index.ts:456](../cost-share-app/apps/mobile/types/index.ts) (FeedItem union)

Extend `FeedItem` with `{ kind: 'settlement', sortAt, settlement }`.

New `SettlementRow` component (sibling of `ExpenseRow` / `MessageRow`):
- Visually distinct from expenses (money-transfer icon, green accent, distinct row layout).
- Text: "Avi paid Dana ₪50" + optional note as a subtitle.
- Tap → action sheet with View / Edit / Delete (Edit/Delete only if current user is the payer or receiver).

Edit reopens the Settle Up sheet pre-filled with the existing values.

### E. Notifications inbox (new, lightweight)
- **Bell icon** in the **header of Group Detail screen**, with an unread-count badge.
- Tapping the bell opens a notifications screen (or sheet) showing notifications scoped to that group.
- Each notification: actor avatar + message ("Avi paid you ₪50", "Avi updated a settlement", "Avi deleted a settlement").
- Tap a notification → marks read + scrolls to the related settlement in the feed.
- Bulk "mark all read" action in the header.

---

## 5. i18n

Reuse `balances.*` where possible. New keys (English baseline — Hebrew equivalents added in [he.json](../cost-share-app/apps/mobile/i18n/locales/he.json)):

```
settleUp.title
settleUp.payer
settleUp.receiver
settleUp.amount
settleUp.currency
settleUp.date
settleUp.paymentMethod
settleUp.note
settleUp.warnPartial            -- "{{remaining}} still owed"
settleUp.warnOverpay            -- "More than what's owed"
settleUp.allSettled             -- "All settled up in {{currency}}"
settleUp.suggestion             -- "{{from}} → {{to}}"
settleUp.submit
settleUp.confirmDelete

notifications.title
notifications.markAllRead
notifications.empty
notifications.settlementCreated -- "{{actor}} recorded a payment"
notifications.settlementUpdated -- "{{actor}} edited a payment"
notifications.settlementDeleted -- "{{actor}} deleted a payment"
```

---

## 6. Implementation order

1. **DB layer**
   - Add `note`, `updated_at`, `deleted_at` columns to `settlements`.
   - Create `notifications` table + RLS.
   - Create trigger on `settlements` to insert notifications.
   - Create RPC `get_group_settle_suggestions`.

2. **Service / hook layer**
   - `settlements.service.ts` — create / update / softDelete / list.
   - `notifications.service.ts` — list / markRead / markAllRead.
   - Query hooks under [hooks/queries/](../cost-share-app/apps/mobile/hooks/queries/) (`useSettlementsQueries.ts`, `useNotificationsQueries.ts`).
   - Add query keys to [keys.ts](../cost-share-app/apps/mobile/hooks/queries/keys.ts).

3. **Settle Up sheet** (`SettleUpSheet.tsx`) — built as a bottom sheet, pre-fillable.

4. **Balances section** on `GroupDetailScreen`.

5. **`SettlementRow`** + extend `FeedItem` union + integrate into the feed.

6. **Notifications inbox** — bell in `GroupDetailScreen` header + inbox screen.

7. **Cleanup** — delete the old [SettleUpScreen.tsx](../cost-share-app/apps/mobile/screens/balances/SettleUpScreen.tsx), remove its route, remove any unused props/types.

---

## 7. Decisions (locked)

| Question | Decision |
|---|---|
| Core goal | Show who owes whom + record payment that affects balances |
| Scope | Per-group only |
| Algorithm | Suggest minimal transactions |
| Who can record/confirm | Either party; other is notified; no confirmation handshake |
| Entry points | Settle-up button on Group Detail + per-suggestion Settle action in balances area |
| History display | Special "payment" entry in feed (distinct from regular expenses) |
| Edit/delete | Yes, by either party anytime; other notified |
| Currency | Multi-currency; balances stay separate per currency, no conversion |
| Partial payments | Allowed; warn if not full or if overpaying |
| Notification channels | In-app inbox + badge only (no push, no email) |
| Dispute | Skipped in v1 |
| Bell + inbox location | Header of Group Detail screen |
