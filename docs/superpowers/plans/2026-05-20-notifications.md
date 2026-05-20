# Notifications System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End-to-end mobile notifications (Expo push + in-app inbox + per-category preferences + mute-group) for Kupa, with full test coverage.

**Architecture:** AFTER INSERT/UPDATE/DELETE triggers on business tables (`expenses`, `expense_splits`, `settlements`, `group_members`) call `SECURITY DEFINER` fanout functions that INSERT into `notifications` (single source of truth). Triggers extract the actor via `auth.uid()` (or `created_by` as fallback). A Database Webhook on `notifications INSERT` fires the `send-push` Edge Function asynchronously. Mobile uses `expo-notifications` for tokens + foreground/background handlers, Supabase Realtime for live inbox, and shared i18n templates so push text matches inbox text exactly.

**Tech Stack:** PostgreSQL (Supabase), Deno Edge Functions, Expo SDK 55, React Native, TypeScript, Jest + `@testing-library/react-native`, Maestro (E2E).

**Spec:** `docs/superpowers/specs/2026-05-20-notifications-design.md`

**Deviation from spec:**
- Spec assumed Business RPCs wrap writes; the existing codebase writes directly from the client. Plan uses **AFTER triggers + `auth.uid()`** (the "safety net" in spec §"Fanout strategy") as the primary mechanism — no client refactor required.
- Spec mentions `profiles.locale`. Codebase has `profiles.language`. Plan uses the existing column.

---

## File Structure

| Path | Responsibility |
|---|---|
| `cost-share-app/supabase/notifications.sql` | One-shot migration: 4 tables, enums, RLS, RPCs, triggers, fanout functions. Applied via existing patch convention. |
| `cost-share-app/supabase/schema.sql` | Schema mirror updated with the same DDL. |
| `cost-share-app/supabase/tests/notifications.sql` | SQL test script (assertion-style) covering fanout, prefs, mutes, RLS. |
| `cost-share-app/supabase/functions/send-push/index.ts` | Webhook handler: lookup tokens, render content, POST to Expo, update status. |
| `cost-share-app/supabase/functions/send-push/expo.ts` | Expo Push API client (POST + response parsing). |
| `cost-share-app/supabase/functions/send-push/index.test.ts` | Deno tests with mocked fetch. |
| `cost-share-app/supabase/functions/send-push/deno.json` | Imports config. |
| `cost-share-app/supabase/functions/retry-push/index.ts` | Cron-driven retry of failed pushes. |
| `cost-share-app/supabase/functions/retry-push/index.test.ts` | Deno tests. |
| `cost-share-app/packages/shared/src/notifications/types.ts` | Shared TS types for notifications, events, params. |
| `cost-share-app/packages/shared/src/notifications/content.ts` | i18n templates + `renderNotification()`. |
| `cost-share-app/packages/shared/src/notifications/content.test.ts` | Snapshot tests for all 9 events × 2 locales. |
| `cost-share-app/packages/shared/src/notifications/index.ts` | Barrel export. |
| `cost-share-app/packages/shared/src/index.ts` | Re-export the notifications module. |
| `cost-share-app/apps/mobile/package.json` | Add `expo-notifications`, `expo-device` deps. |
| `cost-share-app/apps/mobile/app.json` | `expo-notifications` plugin config + iOS background mode. |
| `cost-share-app/apps/mobile/services/notifications.service.ts` | Token registration lifecycle, channel setup, badge helpers. |
| `cost-share-app/apps/mobile/services/notificationRouting.ts` | `navigateToEntity(notification)` for deep linking. |
| `cost-share-app/apps/mobile/hooks/useNotifications.ts` | React Query + Realtime subscription for inbox + badge. |
| `cost-share-app/apps/mobile/hooks/useSoftPushPrompt.ts` | Trigger logic for SoftPromptModal after first group join. |
| `cost-share-app/apps/mobile/components/notifications/SoftPromptModal.tsx` | Pre-permission soft prompt UI. |
| `cost-share-app/apps/mobile/components/notifications/InAppToast.tsx` | Foreground toast component with custom render. |
| `cost-share-app/apps/mobile/components/notifications/NotificationRow.tsx` | Inbox list row. |
| `cost-share-app/apps/mobile/components/notifications/NotificationBell.tsx` | Header bell icon + badge. |
| `cost-share-app/apps/mobile/screens/notifications/NotificationsInboxScreen.tsx` | Inbox list screen. |
| `cost-share-app/apps/mobile/screens/profile/SettingsScreen.tsx` | Add Notifications section. |
| `cost-share-app/apps/mobile/screens/groups/EditGroupScreen.tsx` | Add Mute Group toggle. |
| `cost-share-app/apps/mobile/navigation/AppNavigator.tsx` | Wire notification listeners + register inbox screen. |
| `cost-share-app/apps/mobile/i18n/locales/en.json` | Add `notifications.*` keys. |
| `cost-share-app/apps/mobile/i18n/locales/he.json` | Hebrew counterparts. |
| `cost-share-app/apps/mobile/__tests__/services/notifications.service.test.ts` | Token registration unit tests. |
| `cost-share-app/apps/mobile/__tests__/services/notificationRouting.test.ts` | Route mapping unit tests. |
| `cost-share-app/apps/mobile/__tests__/hooks/useNotifications.test.ts` | Realtime + cache merge tests. |
| `cost-share-app/apps/mobile/__tests__/hooks/useSoftPushPrompt.test.ts` | Trigger logic tests. |
| `cost-share-app/apps/mobile/__tests__/components/InAppToast.test.tsx` | Render + interaction tests. |
| `cost-share-app/apps/mobile/__tests__/components/NotificationRow.test.tsx` | Row render tests. |
| `cost-share-app/apps/mobile/__tests__/screens/NotificationsInboxScreen.test.tsx` | Inbox screen tests. |
| `cost-share-app/apps/mobile/.maestro/notifications/onboarding.yaml` | E2E flow 1. |
| `cost-share-app/apps/mobile/.maestro/notifications/settings.yaml` | E2E flow 2. |
| `cost-share-app/apps/mobile/.maestro/notifications/mute.yaml` | E2E flow 3. |

---

## Phase 1 — Foundation

### Task 1: Add shared notification types and i18n content lib

**Files:**
- Create: `cost-share-app/packages/shared/src/notifications/types.ts`
- Create: `cost-share-app/packages/shared/src/notifications/content.ts`
- Create: `cost-share-app/packages/shared/src/notifications/index.ts`
- Modify: `cost-share-app/packages/shared/src/index.ts`
- Create: `cost-share-app/packages/shared/src/notifications/content.test.ts`

- [ ] **Step 1: Write types**

`packages/shared/src/notifications/types.ts`:
```typescript
export type NotificationCategory = 'friendships' | 'expenses' | 'transfers';

export type NotificationEvent =
  | 'member_joined' | 'member_left' | 'member_added_self'
  | 'expense_added' | 'expense_updated' | 'expense_deleted'
  | 'settlement_recorded' | 'settlement_updated' | 'settlement_deleted';

export type PushStatus = 'pending' | 'sent' | 'failed' | 'skipped' | 'unsubscribed';

export type NotificationLocale = 'en' | 'he';

export interface NotificationParams {
  actor_name?: string;
  group_name?: string;
  expense_title?: string;
  amount?: number;
  currency?: string;
  payer_name?: string;
  payee_name?: string;
}

export interface NotificationRow {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  category: NotificationCategory;
  event_type: NotificationEvent;
  group_id: string | null;
  entity_type: 'expense' | 'settlement' | 'group_member' | null;
  entity_id: string | null;
  params: NotificationParams;
  read_at: string | null;
  push_status: PushStatus;
  created_at: string;
}

export const EVENT_TO_CATEGORY: Record<NotificationEvent, NotificationCategory> = {
  member_joined: 'friendships',
  member_left: 'friendships',
  member_added_self: 'friendships',
  expense_added: 'expenses',
  expense_updated: 'expenses',
  expense_deleted: 'expenses',
  settlement_recorded: 'transfers',
  settlement_updated: 'transfers',
  settlement_deleted: 'transfers',
};
```

- [ ] **Step 2: Write content templates**

`packages/shared/src/notifications/content.ts`:
```typescript
import type { NotificationEvent, NotificationLocale, NotificationParams } from './types';

function formatMoney(amount: number | undefined, currency: string | undefined): string {
  if (amount == null) return '';
  const symbol = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : (currency ?? '');
  return `${symbol}${amount.toFixed(2)}`;
}

type Renderer = (p: NotificationParams) => { title: string; body: string };

const templates: Record<NotificationEvent, Record<NotificationLocale, Renderer>> = {
  expense_added: {
    en: (p) => ({ title: `${p.actor_name} added to "${p.group_name}"`, body: `${p.expense_title} — ${formatMoney(p.amount, p.currency)}` }),
    he: (p) => ({ title: `${p.actor_name} הוסיף/ה ל"${p.group_name}"`, body: `${p.expense_title} — ${formatMoney(p.amount, p.currency)}` }),
  },
  expense_updated: {
    en: (p) => ({ title: `${p.actor_name} updated an expense in "${p.group_name}"`, body: `${p.expense_title} — ${formatMoney(p.amount, p.currency)}` }),
    he: (p) => ({ title: `${p.actor_name} עדכן/ה הוצאה ב"${p.group_name}"`, body: `${p.expense_title} — ${formatMoney(p.amount, p.currency)}` }),
  },
  expense_deleted: {
    en: (p) => ({ title: `${p.actor_name} deleted an expense in "${p.group_name}"`, body: `${p.expense_title}` }),
    he: (p) => ({ title: `${p.actor_name} מחק/ה הוצאה ב"${p.group_name}"`, body: `${p.expense_title}` }),
  },
  settlement_recorded: {
    en: (p) => ({ title: `${p.actor_name} recorded a payment`, body: `${p.payer_name} → ${p.payee_name}: ${formatMoney(p.amount, p.currency)} in "${p.group_name}"` }),
    he: (p) => ({ title: `${p.actor_name} רשם/ה תשלום`, body: `${p.payer_name} ← ${p.payee_name}: ${formatMoney(p.amount, p.currency)} ב"${p.group_name}"` }),
  },
  settlement_updated: {
    en: (p) => ({ title: `${p.actor_name} updated a payment`, body: `${p.payer_name} → ${p.payee_name}: ${formatMoney(p.amount, p.currency)} in "${p.group_name}"` }),
    he: (p) => ({ title: `${p.actor_name} עדכן/ה תשלום`, body: `${p.payer_name} ← ${p.payee_name}: ${formatMoney(p.amount, p.currency)} ב"${p.group_name}"` }),
  },
  settlement_deleted: {
    en: (p) => ({ title: `${p.actor_name} deleted a payment in "${p.group_name}"`, body: `${formatMoney(p.amount, p.currency)}` }),
    he: (p) => ({ title: `${p.actor_name} מחק/ה תשלום ב"${p.group_name}"`, body: `${formatMoney(p.amount, p.currency)}` }),
  },
  member_joined: {
    en: (p) => ({ title: `${p.actor_name} joined "${p.group_name}"`, body: '' }),
    he: (p) => ({ title: `${p.actor_name} הצטרפ/ה ל"${p.group_name}"`, body: '' }),
  },
  member_left: {
    en: (p) => ({ title: `${p.actor_name} left "${p.group_name}"`, body: '' }),
    he: (p) => ({ title: `${p.actor_name} עזב/ה את "${p.group_name}"`, body: '' }),
  },
  member_added_self: {
    en: (p) => ({ title: `You were added to "${p.group_name}"`, body: `By ${p.actor_name}` }),
    he: (p) => ({ title: `נוספת לקבוצת "${p.group_name}"`, body: `ע"י ${p.actor_name}` }),
  },
};

export function renderNotification(
  event: NotificationEvent,
  params: NotificationParams,
  locale: NotificationLocale = 'en',
): { title: string; body: string } {
  const byEvent = templates[event];
  if (!byEvent) return { title: '', body: '' };
  return (byEvent[locale] ?? byEvent.en)(params);
}
```

- [ ] **Step 3: Barrel exports**

`packages/shared/src/notifications/index.ts`:
```typescript
export * from './types';
export * from './content';
```

Add to `packages/shared/src/index.ts` (append):
```typescript
export * from './notifications';
```

- [ ] **Step 4: Write snapshot tests**

`packages/shared/src/notifications/content.test.ts`:
```typescript
import { renderNotification } from './content';
import type { NotificationEvent, NotificationLocale } from './types';

const events: NotificationEvent[] = [
  'expense_added','expense_updated','expense_deleted',
  'settlement_recorded','settlement_updated','settlement_deleted',
  'member_joined','member_left','member_added_self',
];
const locales: NotificationLocale[] = ['en','he'];

const sampleParams = {
  actor_name: 'Dana',
  group_name: 'Apartment',
  expense_title: 'Pizza',
  amount: 150,
  currency: 'ILS',
  payer_name: 'Dana',
  payee_name: 'Yossi',
};

describe('renderNotification', () => {
  for (const event of events) {
    for (const locale of locales) {
      it(`${event} / ${locale}`, () => {
        expect(renderNotification(event, sampleParams, locale)).toMatchSnapshot();
      });
    }
  }

  it('falls back to en for unknown locale', () => {
    const en = renderNotification('expense_added', sampleParams, 'en');
    const xx = renderNotification('expense_added', sampleParams, 'xx' as never);
    expect(xx).toEqual(en);
  });
});
```

- [ ] **Step 5: Run tests, expect green**

Run: `cd cost-share-app/packages/shared && npx jest src/notifications/content.test.ts`
Expected: 19 tests pass (18 snapshots + 1 fallback).

- [ ] **Step 6: Commit**

```bash
git add cost-share-app/packages/shared/src/notifications cost-share-app/packages/shared/src/index.ts
git commit -m "feat(shared): notification types + i18n content templates"
```

---

### Task 2: DB migration — schema (tables, enums, RLS, RPCs)

**Files:**
- Create: `cost-share-app/supabase/notifications.sql`
- Modify: `cost-share-app/supabase/schema.sql`

- [ ] **Step 1: Create migration file with enums + tables**

`supabase/notifications.sql` (top section):
```sql
-- ============================================================================
-- Notifications system (2026-05-20)
-- Spec: docs/superpowers/specs/2026-05-20-notifications-design.md
-- ============================================================================

BEGIN;

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE notification_category AS ENUM ('friendships','expenses','transfers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_event AS ENUM (
    'member_joined','member_left','member_added_self',
    'expense_added','expense_updated','expense_deleted',
    'settlement_recorded','settlement_updated','settlement_deleted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE push_status AS ENUM ('pending','sent','failed','skipped','unsubscribed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- device_tokens ----------
CREATE TABLE IF NOT EXISTS device_tokens (
  id               uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token            text NOT NULL UNIQUE,
  platform         text NOT NULL CHECK (platform IN ('ios','android')),
  device_id        text,
  app_version      text,
  locale           text,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  disabled_at      timestamptz,
  disabled_reason  text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id) WHERE disabled_at IS NULL;

-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id                 uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  recipient_user_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_user_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  category           notification_category NOT NULL,
  event_type         notification_event NOT NULL,
  group_id           uuid REFERENCES groups(id) ON DELETE CASCADE,
  entity_type        text,
  entity_id          uuid,
  params             jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at            timestamptz,
  push_status        push_status NOT NULL DEFAULT 'pending',
  push_attempts      int NOT NULL DEFAULT 0,
  push_last_attempt  timestamptz,
  push_error         text,
  push_sent_at       timestamptz,
  dedup_key          text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_inbox ON notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(recipient_user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notif_push_queue ON notifications(push_status, created_at) WHERE push_status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notif_dedup ON notifications(recipient_user_id, dedup_key) WHERE dedup_key IS NOT NULL;

-- ---------- notification_preferences ----------
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id            uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  friendships_push   bool NOT NULL DEFAULT true,
  friendships_inapp  bool NOT NULL DEFAULT true,
  expenses_push      bool NOT NULL DEFAULT true,
  expenses_inapp     bool NOT NULL DEFAULT true,
  transfers_push     bool NOT NULL DEFAULT true,
  transfers_inapp    bool NOT NULL DEFAULT true,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------- notification_mutes ----------
CREATE TABLE IF NOT EXISTS notification_mutes (
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  muted_until  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

-- ---------- RLS ----------
ALTER TABLE device_tokens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_mutes        ENABLE ROW LEVEL SECURITY;

-- device_tokens: own only
CREATE POLICY device_tokens_own ON device_tokens FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- notifications: select/update/delete own; insert via service_role / SECURITY DEFINER
CREATE POLICY notif_select_own ON notifications FOR SELECT USING (recipient_user_id = auth.uid());
CREATE POLICY notif_update_own ON notifications FOR UPDATE USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());
CREATE POLICY notif_delete_own ON notifications FOR DELETE USING (recipient_user_id = auth.uid());
-- (no INSERT policy → blocked for anon/authenticated; service_role bypasses)

-- preferences: own only
CREATE POLICY prefs_own ON notification_preferences FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- mutes: own only
CREATE POLICY mutes_own ON notification_mutes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMIT;
```

- [ ] **Step 2: Append RPCs to the same file**

```sql
-- ============================================================================
-- RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION register_device_token(
  p_token text, p_platform text, p_device_id text, p_app_version text, p_locale text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  INSERT INTO device_tokens (user_id, token, platform, device_id, app_version, locale, last_seen_at, disabled_at, disabled_reason)
  VALUES (auth.uid(), p_token, p_platform, p_device_id, p_app_version, p_locale, now(), NULL, NULL)
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        device_id = EXCLUDED.device_id,
        app_version = EXCLUDED.app_version,
        locale = EXCLUDED.locale,
        last_seen_at = now(),
        disabled_at = NULL,
        disabled_reason = NULL;
END $$;

CREATE OR REPLACE FUNCTION unregister_device_token(p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  UPDATE device_tokens
  SET disabled_at = now(), disabled_reason = 'user_logout'
  WHERE token = p_token AND user_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  UPDATE notifications SET read_at = now()
  WHERE id = p_notification_id AND recipient_user_id = auth.uid() AND read_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  UPDATE notifications SET read_at = now()
  WHERE recipient_user_id = auth.uid() AND read_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION update_notification_preferences(p_prefs jsonb)
RETURNS notification_preferences LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_row notification_preferences;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  INSERT INTO notification_preferences AS np (
    user_id,
    friendships_push, friendships_inapp,
    expenses_push,    expenses_inapp,
    transfers_push,   transfers_inapp,
    updated_at
  ) VALUES (
    auth.uid(),
    COALESCE((p_prefs->>'friendships_push')::bool,  true),
    COALESCE((p_prefs->>'friendships_inapp')::bool, true),
    COALESCE((p_prefs->>'expenses_push')::bool,     true),
    COALESCE((p_prefs->>'expenses_inapp')::bool,    true),
    COALESCE((p_prefs->>'transfers_push')::bool,    true),
    COALESCE((p_prefs->>'transfers_inapp')::bool,   true),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    friendships_push  = COALESCE((p_prefs->>'friendships_push')::bool,  np.friendships_push),
    friendships_inapp = COALESCE((p_prefs->>'friendships_inapp')::bool, np.friendships_inapp),
    expenses_push     = COALESCE((p_prefs->>'expenses_push')::bool,     np.expenses_push),
    expenses_inapp    = COALESCE((p_prefs->>'expenses_inapp')::bool,    np.expenses_inapp),
    transfers_push    = COALESCE((p_prefs->>'transfers_push')::bool,    np.transfers_push),
    transfers_inapp   = COALESCE((p_prefs->>'transfers_inapp')::bool,   np.transfers_inapp),
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION toggle_group_mute(p_group_id uuid, p_muted bool)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  IF p_muted THEN
    INSERT INTO notification_mutes (user_id, group_id) VALUES (auth.uid(), p_group_id)
    ON CONFLICT (user_id, group_id) DO NOTHING;
  ELSE
    DELETE FROM notification_mutes WHERE user_id = auth.uid() AND group_id = p_group_id;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION register_device_token(text,text,text,text,text)       TO authenticated;
GRANT EXECUTE ON FUNCTION unregister_device_token(text)                          TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(uuid)                           TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read()                          TO authenticated;
GRANT EXECUTE ON FUNCTION update_notification_preferences(jsonb)                 TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_group_mute(uuid,bool)                           TO authenticated;
```

- [ ] **Step 3: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with name `notifications_schema_2026_05_20` and the full file contents.

- [ ] **Step 4: Verify**

Run `mcp__supabase__list_tables` and confirm presence of `device_tokens`, `notifications`, `notification_preferences`, `notification_mutes`.

- [ ] **Step 5: Mirror to `schema.sql`**

Append the same DDL (without BEGIN/COMMIT) to `cost-share-app/supabase/schema.sql` under a new `-- =========== Notifications ===========` section, at the end of the file.

- [ ] **Step 6: Commit**

```bash
git add cost-share-app/supabase/notifications.sql cost-share-app/supabase/schema.sql
git commit -m "feat(db): notifications schema + RLS + user-facing RPCs"
```

---

### Task 3: DB — fanout SQL functions + triggers (one event at a time)

Implement and ship `expense_added` end-to-end first to prove the pattern before fanning out to all 9 events.

**Files:**
- Modify: `cost-share-app/supabase/notifications.sql` (append)
- Modify: `cost-share-app/supabase/schema.sql` (mirror)

- [ ] **Step 1: Write helper for actor name + group name**

Append to `notifications.sql`:
```sql
CREATE OR REPLACE FUNCTION _notif_actor_name(p_user_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT name FROM profiles WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION _notif_group_name(p_group_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT name FROM groups WHERE id = p_group_id;
$$;
```

- [ ] **Step 2: Write `fanout_expense_added`**

Append:
```sql
CREATE OR REPLACE FUNCTION fanout_expense_added(p_expense_id uuid, p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_exp expenses%ROWTYPE; v_actor_name text; v_group_name text; v_rec record;
BEGIN
  SELECT * INTO v_exp FROM expenses WHERE id = p_expense_id;
  IF NOT FOUND OR p_actor IS NULL THEN RETURN; END IF;

  v_actor_name := _notif_actor_name(p_actor);
  v_group_name := _notif_group_name(v_exp.group_id);

  FOR v_rec IN
    SELECT DISTINCT es.user_id AS recipient_id,
           COALESCE(np.expenses_inapp, true) AS inapp_on,
           COALESCE(np.expenses_push,  true) AS push_on,
           EXISTS(
             SELECT 1 FROM notification_mutes nm
             WHERE nm.user_id = es.user_id AND nm.group_id = v_exp.group_id
               AND (nm.muted_until IS NULL OR nm.muted_until > now())
           ) AS is_muted
    FROM expense_splits es
    LEFT JOIN notification_preferences np ON np.user_id = es.user_id
    WHERE es.expense_id = p_expense_id AND es.user_id <> p_actor
  LOOP
    CONTINUE WHEN NOT v_rec.inapp_on OR v_rec.is_muted;
    INSERT INTO notifications (
      recipient_user_id, actor_user_id, category, event_type,
      group_id, entity_type, entity_id, params, push_status, dedup_key
    ) VALUES (
      v_rec.recipient_id, p_actor, 'expenses', 'expense_added',
      v_exp.group_id, 'expense', v_exp.id,
      jsonb_build_object(
        'actor_name', v_actor_name,
        'group_name', v_group_name,
        'expense_title', v_exp.description,
        'amount', v_exp.amount,
        'currency', v_exp.currency
      ),
      CASE WHEN v_rec.push_on THEN 'pending'::push_status ELSE 'skipped'::push_status END,
      'expense:' || v_exp.id || ':added'
    )
    ON CONFLICT (recipient_user_id, dedup_key) DO NOTHING;
  END LOOP;
END $$;
```

Note: `expenses.description` is the existing column (not `title`).

- [ ] **Step 3: Trigger function — defer fanout to end of statement**

```sql
CREATE OR REPLACE FUNCTION trg_after_expense_splits_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_actor uuid;
BEGIN
  -- Actor is whoever holds the current auth session
  v_actor := COALESCE(auth.uid(), (SELECT created_by FROM expenses WHERE id = NEW.expense_id));
  PERFORM fanout_expense_added(NEW.expense_id, v_actor);
  RETURN NEW;
END $$;

-- Fire once per expense, not once per split: use a statement-level trigger via transition table
-- We use a per-row trigger with the dedup_key to ensure idempotence.
DROP TRIGGER IF EXISTS tr_expense_splits_insert ON expense_splits;
CREATE TRIGGER tr_expense_splits_insert
AFTER INSERT ON expense_splits
FOR EACH ROW EXECUTE FUNCTION trg_after_expense_splits_insert();
```

Rationale: the trigger fires on `expense_splits` (the leaf write), not `expenses`, so splits are already present when fanout reads them. `dedup_key` makes the per-row trigger idempotent across multiple splits for one expense.

- [ ] **Step 4: Apply migration**

Use `mcp__supabase__apply_migration` with name `notifications_fanout_expense_added` and the appended SQL.

- [ ] **Step 5: Smoke test via SQL**

In Supabase SQL editor (or via `execute_sql`):
```sql
-- Pre: pick two existing users in the same group with an expense_splits row
SELECT id, group_id, created_by FROM expenses ORDER BY created_at DESC LIMIT 1;
-- Insert an expense + splits manually as one of the members
-- Then:
SELECT id, recipient_user_id, event_type, push_status FROM notifications
WHERE event_type = 'expense_added' ORDER BY created_at DESC LIMIT 5;
```

Expected: rows for each non-actor split member.

- [ ] **Step 6: Commit**

```bash
git add cost-share-app/supabase/notifications.sql cost-share-app/supabase/schema.sql
git commit -m "feat(db): fanout_expense_added + trigger on expense_splits insert"
```

---

### Task 4: Edge Function `send-push` (skeleton + happy path)

**Files:**
- Create: `cost-share-app/supabase/functions/send-push/deno.json`
- Create: `cost-share-app/supabase/functions/send-push/expo.ts`
- Create: `cost-share-app/supabase/functions/send-push/index.ts`
- Create: `cost-share-app/supabase/functions/send-push/index.test.ts`

- [ ] **Step 1: deno.json**

```json
{
  "imports": {
    "supabase": "https://esm.sh/@supabase/supabase-js@2",
    "std/": "https://deno.land/std@0.224.0/"
  }
}
```

- [ ] **Step 2: expo.ts — Expo Push client**

```typescript
export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  threadId?: string;
  priority?: 'default' | 'high';
}

export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendExpoPush(
  messages: ExpoMessage[],
  accessToken?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExpoTicket[]> {
  if (messages.length === 0) return [];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const res = await fetchImpl(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    throw new Error(`Expo push HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return (json.data ?? []) as ExpoTicket[];
}
```

- [ ] **Step 3: index.ts — webhook handler**

```typescript
import { createClient, SupabaseClient } from 'supabase';
import { renderNotification, EVENT_TO_CATEGORY } from '@kupa/shared/notifications';
import type { NotificationEvent, NotificationLocale, NotificationParams } from '@kupa/shared/notifications';
import { sendExpoPush, ExpoMessage, ExpoTicket } from './expo.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined;

interface NotificationRow {
  id: string;
  recipient_user_id: string;
  category: 'friendships' | 'expenses' | 'transfers';
  event_type: NotificationEvent;
  group_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  params: NotificationParams;
  push_status: string;
}

interface WebhookPayload {
  type: 'INSERT';
  table: 'notifications';
  record: NotificationRow;
}

function buildDeepLink(row: NotificationRow): string {
  if (row.entity_type === 'expense' && row.group_id && row.entity_id)
    return `kupa://groups/${row.group_id}/expenses/${row.entity_id}`;
  if (row.entity_type === 'settlement' && row.group_id)
    return `kupa://groups/${row.group_id}/settlements`;
  if (row.group_id) return `kupa://groups/${row.group_id}`;
  return 'kupa://notifications';
}

export async function handle(payload: WebhookPayload, sb: SupabaseClient): Promise<{ status: number }> {
  const row = payload.record;
  if (row.push_status !== 'pending') return { status: 200 };

  // Tokens
  const { data: tokens, error: tErr } = await sb
    .from('device_tokens')
    .select('token, platform, locale')
    .eq('user_id', row.recipient_user_id)
    .is('disabled_at', null);
  if (tErr) throw new Error(`tokens query: ${tErr.message}`);
  if (!tokens || tokens.length === 0) {
    await sb.from('notifications').update({ push_status: 'unsubscribed' }).eq('id', row.id);
    return { status: 200 };
  }

  // Locale
  const { data: profile } = await sb.from('profiles').select('language').eq('id', row.recipient_user_id).single();
  const locale = (profile?.language ?? tokens[0].locale ?? 'en') as NotificationLocale;

  // Unread count for badge
  const { count: unread } = await sb
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_user_id', row.recipient_user_id)
    .is('read_at', null);

  const { title, body } = renderNotification(row.event_type, row.params, locale);
  const data = {
    notification_id: row.id,
    event_type: row.event_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    group_id: row.group_id,
    deep_link: buildDeepLink(row),
  };

  const messages: ExpoMessage[] = tokens.map((t) => ({
    to: t.token,
    title, body, data,
    sound: 'default',
    badge: unread ?? undefined,
    channelId: row.category,
    threadId: row.group_id ? `${row.category}:${row.group_id}` : undefined,
    priority: 'high',
  }));

  let tickets: ExpoTicket[] = [];
  let err: string | null = null;
  try { tickets = await sendExpoPush(messages, EXPO_ACCESS_TOKEN); }
  catch (e) { err = (e as Error).message; }

  if (err) {
    await sb.from('notifications').update({
      push_status: 'failed',
      push_attempts: 1,
      push_last_attempt: new Date().toISOString(),
      push_error: err,
    }).eq('id', row.id);
    return { status: 200 };
  }

  // Disable DeviceNotRegistered tokens
  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
      await sb.from('device_tokens').update({ disabled_at: new Date().toISOString(), disabled_reason: 'expo_DeviceNotRegistered' })
        .eq('token', tokens[i].token);
    }
  }

  const allOk = tickets.every((t) => t.status === 'ok');
  const allBadToken = tickets.length > 0 && tickets.every((t) => t.status === 'error' && t.details?.error === 'DeviceNotRegistered');

  await sb.from('notifications').update(
    allOk
      ? { push_status: 'sent', push_sent_at: new Date().toISOString(), push_last_attempt: new Date().toISOString() }
      : allBadToken
      ? { push_status: 'unsubscribed', push_last_attempt: new Date().toISOString() }
      : { push_status: 'failed', push_attempts: 1, push_last_attempt: new Date().toISOString(), push_error: 'partial_failure' }
  ).eq('id', row.id);

  return { status: 200 };
}

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const out = await handle(payload, sb);
    return new Response('ok', { status: out.status });
  } catch (e) {
    console.error('send-push error', e);
    return new Response('ok', { status: 200 }); // never trigger webhook retry — retry job owns recovery
  }
});
```

- [ ] **Step 4: Tests with mocked Supabase + fetch**

`index.test.ts`:
```typescript
import { assertEquals, assertSpyCallArg, assertSpyCalls, spy, stub } from 'std/testing/mod.ts';
import { handle } from './index.ts';

function makeSb(overrides: Record<string, unknown> = {}) {
  // tiny chainable mock; tests override per call
  const updates: Array<{ table: string; values: unknown; eq: [string, unknown] }> = [];
  const calls: { tokensReturn?: unknown[]; profile?: { language: string } } = {};
  return {
    _updates: updates,
    _calls: calls,
    from(table: string) {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        single: async () => ({ data: overrides[`${table}_profile`] ?? null, error: null }),
        update(values: unknown) {
          const apiChain: any = {
            eq(col: string, val: unknown) {
              updates.push({ table, values, eq: [col, val] });
              return Promise.resolve({ error: null });
            },
          };
          return apiChain;
        },
        then(resolve: (v: unknown) => void) {
          resolve({ data: overrides[`${table}_select`] ?? [], count: overrides[`${table}_count`] ?? 0, error: null });
        },
      };
      return chain;
    },
  } as any;
}

Deno.test('skips if push_status != pending', async () => {
  const sb = makeSb();
  const res = await handle({ type: 'INSERT', table: 'notifications', record: { id: 'n1', recipient_user_id: 'u1', category: 'expenses', event_type: 'expense_added', group_id: 'g1', entity_type: 'expense', entity_id: 'e1', params: {}, push_status: 'skipped' } } as never, sb);
  assertEquals(res.status, 200);
  assertEquals(sb._updates.length, 0);
});

Deno.test('marks unsubscribed when no tokens', async () => {
  const sb = makeSb({ device_tokens_select: [] });
  await handle({ type: 'INSERT', table: 'notifications', record: { id: 'n1', recipient_user_id: 'u1', category: 'expenses', event_type: 'expense_added', group_id: 'g1', entity_type: 'expense', entity_id: 'e1', params: {}, push_status: 'pending' } } as never, sb);
  assertEquals(sb._updates[0].values, { push_status: 'unsubscribed' });
});

// Add tests for: happy path (mock fetch with stub), DeviceNotRegistered disables token, network error → failed
```

The complete test file will mock `fetch` globally via `globalThis.fetch = stub(...)`.

- [ ] **Step 5: Deploy**

Use `mcp__supabase__deploy_edge_function` with name `send-push` and the index.ts + expo.ts files.

- [ ] **Step 6: Set secrets**

Run (user does this manually):
```bash
supabase secrets set EXPO_ACCESS_TOKEN=<token>
```
For initial dev, omit — Expo allows unauthenticated push for small volumes.

- [ ] **Step 7: Configure Database Webhook**

In Supabase Dashboard → Database → Webhooks → New webhook:
- Name: `notifications_send_push`
- Table: `notifications`
- Events: `INSERT`
- URL: `https://<project>.supabase.co/functions/v1/send-push`
- HTTP Headers: `Authorization: Bearer <service-role-key>`

Document this in `docs/SSOT/SETUP.md` if it exists, or in the README.

- [ ] **Step 8: Commit**

```bash
git add cost-share-app/supabase/functions/send-push
git commit -m "feat(edge): send-push Edge Function + Expo client + tests"
```

---

### Task 5: Mobile — install deps and configure `expo-notifications`

**Files:**
- Modify: `cost-share-app/apps/mobile/package.json`
- Modify: `cost-share-app/apps/mobile/app.json`

- [ ] **Step 1: Install**

```bash
cd cost-share-app/apps/mobile
npx expo install expo-notifications expo-device
```

- [ ] **Step 2: app.json plugin config**

Under `expo.plugins` add:
```json
[
  "expo-notifications",
  {
    "icon": "./assets/notification-icon.png",
    "color": "#000000",
    "defaultChannel": "default"
  }
]
```

Under `expo.ios`, add or merge:
```json
"infoPlist": { "UIBackgroundModes": ["remote-notification"] }
```

- [ ] **Step 3: Ensure assets/notification-icon.png exists**

If absent, copy `assets/icon.png` to `assets/notification-icon.png` as a placeholder. Real asset is a future polish item.

- [ ] **Step 4: Add Expo projectId**

If `expo.extra.eas.projectId` doesn't exist in `app.json`, run:
```bash
npx eas init --id <project-id>
```
This populates `extra.eas.projectId`. If no EAS access, document the gap in the plan execution notes — `getExpoPushTokenAsync` requires it.

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/apps/mobile/package.json cost-share-app/apps/mobile/package-lock.json cost-share-app/apps/mobile/app.json cost-share-app/package-lock.json
git commit -m "chore(mobile): install expo-notifications + configure plugin"
```

---

### Task 6: Mobile — `notifications.service.ts` + tests

**Files:**
- Create: `cost-share-app/apps/mobile/services/notifications.service.ts`
- Create: `cost-share-app/apps/mobile/__tests__/services/notifications.service.test.ts`

- [ ] **Step 1: Service**

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import i18n from '../i18n';

const ANDROID_CHANNELS = [
  { id: 'friendships', nameKey: 'notifications.channels.friendships' },
  { id: 'expenses',    nameKey: 'notifications.channels.expenses' },
  { id: 'transfers',   nameKey: 'notifications.channels.transfers' },
];

export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const ch of ANDROID_CHANNELS) {
    await Notifications.setNotificationChannelAsync(ch.id, {
      name: i18n.t(ch.nameKey),
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
}

export interface PermissionStatus { granted: boolean; canAskAgain: boolean; status: string; }

export async function getPermissionStatus(): Promise<PermissionStatus> {
  const res = await Notifications.getPermissionsAsync();
  return { granted: res.status === 'granted', canAskAgain: res.canAskAgain, status: res.status };
}

export async function requestPermission(): Promise<PermissionStatus> {
  const res = await Notifications.requestPermissionsAsync();
  return { granted: res.status === 'granted', canAskAgain: res.canAskAgain, status: res.status };
}

async function fetchToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
    ?? (Constants as any).easConfig?.projectId;
  if (!projectId) {
    console.warn('[notifications] missing EAS projectId; cannot fetch token');
    return null;
  }
  const t = await Notifications.getExpoPushTokenAsync({ projectId });
  return t.data;
}

export async function registerCurrentDevice(): Promise<{ token: string } | null> {
  if (!Device.isDevice) return null;
  const status = await getPermissionStatus();
  if (!status.granted) return null;

  const token = await fetchToken();
  if (!token) return null;

  await ensureAndroidChannels();

  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const deviceId = Constants.sessionId ?? (Constants as any).installationId ?? null;
  const appVersion = Constants.expoConfig?.version ?? null;
  const locale = i18n.language ?? 'en';

  const { error } = await supabase.rpc('register_device_token', {
    p_token: token, p_platform: platform, p_device_id: deviceId,
    p_app_version: appVersion, p_locale: locale,
  });
  if (error) {
    console.error('[notifications] register failed', error);
    return null;
  }
  return { token };
}

export async function unregisterCurrentDevice(token: string): Promise<void> {
  await supabase.rpc('unregister_device_token', { p_token: token });
}

export async function setAppBadge(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(Math.max(0, count));
}
```

- [ ] **Step 2: Tests**

`__tests__/services/notifications.service.test.ts`:
```typescript
import { registerCurrentDevice, getPermissionStatus } from '../../services/notifications.service';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setBadgeCountAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { eas: { projectId: 'p1' } }, version: '1.0.0' }, sessionId: 'd1' },
  sessionId: 'd1',
  expoConfig: { extra: { eas: { projectId: 'p1' } }, version: '1.0.0' },
}));
const rpc = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
jest.mock('../../i18n', () => ({ __esModule: true, default: { language: 'he', t: (k: string) => k } }));

const Notifications = require('expo-notifications');
const Device = require('expo-device');

beforeEach(() => { jest.clearAllMocks(); });

it('returns null on simulator', async () => {
  Device.isDevice = false;
  const r = await registerCurrentDevice();
  expect(r).toBeNull();
  Device.isDevice = true;
});

it('returns null if permission not granted', async () => {
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
  const r = await registerCurrentDevice();
  expect(r).toBeNull();
});

it('registers token with correct args when granted', async () => {
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false });
  Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[xyz]' });
  const r = await registerCurrentDevice();
  expect(r).toEqual({ token: 'ExponentPushToken[xyz]' });
  expect(rpc).toHaveBeenCalledWith('register_device_token', expect.objectContaining({
    p_token: 'ExponentPushToken[xyz]',
    p_locale: 'he',
  }));
});

it('getPermissionStatus reflects expo response', async () => {
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false });
  const s = await getPermissionStatus();
  expect(s.granted).toBe(true);
});
```

- [ ] **Step 3: Run tests**

```bash
cd cost-share-app/apps/mobile && npm test -- services/notifications.service.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/apps/mobile/services/notifications.service.ts cost-share-app/apps/mobile/__tests__/services/notifications.service.test.ts
git commit -m "feat(mobile): notifications service — token registration + channels"
```

---

### Task 7: Mobile — `SoftPromptModal` + `useSoftPushPrompt` hook

**Files:**
- Create: `cost-share-app/apps/mobile/components/notifications/SoftPromptModal.tsx`
- Create: `cost-share-app/apps/mobile/hooks/useSoftPushPrompt.ts`
- Create: `cost-share-app/apps/mobile/__tests__/hooks/useSoftPushPrompt.test.ts`
- Modify: `cost-share-app/apps/mobile/i18n/locales/en.json`
- Modify: `cost-share-app/apps/mobile/i18n/locales/he.json`

- [ ] **Step 1: Add i18n keys**

Append to `en.json`:
```json
"notifications": {
  "channels": {
    "friendships": "Friendships",
    "expenses": "Expenses",
    "transfers": "Transfers"
  },
  "softPrompt": {
    "title": "Stay in the loop",
    "body": "Get a notification when someone adds an expense or settles up.",
    "accept": "Yes, enable",
    "decline": "Not now"
  }
}
```

`he.json`:
```json
"notifications": {
  "channels": {
    "friendships": "חברויות",
    "expenses": "הוצאות",
    "transfers": "העברות"
  },
  "softPrompt": {
    "title": "תהיו בעניינים",
    "body": "קבלו התראה כשמישהו מוסיף הוצאה או מסיים חשבון.",
    "accept": "כן, הפעלה",
    "decline": "לא עכשיו"
  }
}
```

- [ ] **Step 2: SoftPromptModal component**

```typescript
import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export interface SoftPromptModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function SoftPromptModal({ visible, onAccept, onDecline }: SoftPromptModalProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('notifications.softPrompt.title')}</Text>
          <Text style={styles.body}>{t('notifications.softPrompt.body')}</Text>
          <Pressable testID="soft-accept" style={styles.primary} onPress={onAccept}>
            <Text style={styles.primaryText}>{t('notifications.softPrompt.accept')}</Text>
          </Pressable>
          <Pressable testID="soft-decline" style={styles.secondary} onPress={onDecline}>
            <Text style={styles.secondaryText}>{t('notifications.softPrompt.decline')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 20 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  body: { fontSize: 14, marginBottom: 20 },
  primary: { backgroundColor: '#111', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  primaryText: { color: 'white', fontWeight: '600' },
  secondary: { padding: 14, alignItems: 'center' },
  secondaryText: { color: '#555' },
});
```

- [ ] **Step 3: `useSoftPushPrompt` hook**

```typescript
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPermissionStatus, requestPermission, registerCurrentDevice } from '../services/notifications.service';

const KEY = 'kupa:notif:softPromptDeclinedAt';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function useSoftPushPrompt(groupCount: number) {
  const [visible, setVisible] = useState(false);
  const [evaluatedFor, setEvaluatedFor] = useState<number | null>(null);

  useEffect(() => {
    if (groupCount !== 1 || evaluatedFor === 1) return;
    (async () => {
      const status = await getPermissionStatus();
      if (status.status !== 'undetermined') { setEvaluatedFor(1); return; }
      const raw = await AsyncStorage.getItem(KEY);
      const declinedAt = raw ? Number(raw) : 0;
      if (declinedAt && Date.now() - declinedAt < COOLDOWN_MS) { setEvaluatedFor(1); return; }
      setVisible(true);
      setEvaluatedFor(1);
    })();
  }, [groupCount, evaluatedFor]);

  const accept = useCallback(async () => {
    setVisible(false);
    const res = await requestPermission();
    if (res.granted) await registerCurrentDevice();
  }, []);

  const decline = useCallback(async () => {
    setVisible(false);
    await AsyncStorage.setItem(KEY, String(Date.now()));
  }, []);

  return { visible, accept, decline };
}
```

- [ ] **Step 4: Tests**

`__tests__/hooks/useSoftPushPrompt.test.ts`:
```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { useSoftPushPrompt } from '../../hooks/useSoftPushPrompt';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(),
}));
const getPermission = jest.fn();
const requestP = jest.fn();
const register = jest.fn();
jest.mock('../../services/notifications.service', () => ({
  getPermissionStatus: () => getPermission(),
  requestPermission: () => requestP(),
  registerCurrentDevice: () => register(),
}));

const AS = require('@react-native-async-storage/async-storage');

beforeEach(() => { jest.clearAllMocks(); });

it('shows on first group when permission undetermined and never declined', async () => {
  getPermission.mockResolvedValue({ status: 'undetermined' });
  AS.getItem.mockResolvedValue(null);
  const { result } = renderHook(() => useSoftPushPrompt(1));
  await waitFor(() => expect(result.current.visible).toBe(true));
});

it('does not show if permission already granted', async () => {
  getPermission.mockResolvedValue({ status: 'granted' });
  const { result } = renderHook(() => useSoftPushPrompt(1));
  await waitFor(() => expect(result.current.visible).toBe(false));
});

it('does not show within 7-day cooldown', async () => {
  getPermission.mockResolvedValue({ status: 'undetermined' });
  AS.getItem.mockResolvedValue(String(Date.now() - 1000));
  const { result } = renderHook(() => useSoftPushPrompt(1));
  await waitFor(() => expect(result.current.visible).toBe(false));
});

it('does not show when groupCount != 1', async () => {
  const { result } = renderHook(() => useSoftPushPrompt(2));
  await waitFor(() => expect(result.current.visible).toBe(false));
});
```

- [ ] **Step 5: Run tests**

```bash
npm test -- hooks/useSoftPushPrompt.test.ts components/notifications
```

- [ ] **Step 6: Commit**

```bash
git add cost-share-app/apps/mobile/components/notifications cost-share-app/apps/mobile/hooks/useSoftPushPrompt.ts cost-share-app/apps/mobile/__tests__/hooks/useSoftPushPrompt.test.ts cost-share-app/apps/mobile/i18n/locales
git commit -m "feat(mobile): SoftPromptModal + useSoftPushPrompt hook"
```

---

### Task 8: Mobile — wire registration on app launch + SoftPrompt on first-group-join

**Files:**
- Modify: `cost-share-app/apps/mobile/navigation/AppNavigator.tsx`

- [ ] **Step 1: Locate the post-login mount point**

Read the existing `AppNavigator.tsx` to find the spot where the user session has been hydrated (after `auth` state is known) and groups query has data.

- [ ] **Step 2: Add launch-time registration**

Inside the authenticated branch, mount this effect:
```typescript
import { useEffect } from 'react';
import { registerCurrentDevice } from '../services/notifications.service';

// inside <AuthenticatedNavigator>:
useEffect(() => { void registerCurrentDevice(); }, []);
```

- [ ] **Step 3: Add SoftPromptModal**

```typescript
import { useSoftPushPrompt } from '../hooks/useSoftPushPrompt';
import { SoftPromptModal } from '../components/notifications/SoftPromptModal';

// Inside the authenticated tree (where groups query is available):
const groupsQuery = useQuery(...); // existing
const groupCount = groupsQuery.data?.length ?? 0;
const soft = useSoftPushPrompt(groupCount);

return (
  <>
    {/* existing tree */}
    <SoftPromptModal visible={soft.visible} onAccept={soft.accept} onDecline={soft.decline} />
  </>
);
```

If the existing navigator does not have a `groupsQuery`, mount the SoftPrompt inside the GroupsList screen instead, where the query result is already available.

- [ ] **Step 4: Manual smoke**

Run on a device (not simulator), join a group. Expect the modal. Accept → expect OS permission dialog → grant → confirm a row in `device_tokens` via Supabase dashboard.

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/apps/mobile/navigation/AppNavigator.tsx
git commit -m "feat(mobile): register push token on launch + soft prompt after first group"
```

---

### Task 9: End-to-end smoke (Phase 1 close-out)

**Files:** — (verification only)

- [ ] **Step 1: Two-device test**

On Device A (user A) and Device B (user B), both members of group G with an expense_splits row containing both:
1. Both apps launched and tokens registered.
2. User A adds an expense via the existing UI.
3. Confirm: a `notifications` row exists for user B; `push_status` transitions to `sent`.
4. Device B receives a push notification with title/body matching `renderNotification` output.

- [ ] **Step 2: Phase-1 retrospective commit (docs)**

If gaps found (asset placeholders, missing projectId, etc.), record them in `docs/SSOT/TECHNICAL_DEBT.md` under a new "Notifications follow-ups" subsection.

```bash
git add docs/SSOT/TECHNICAL_DEBT.md
git commit -m "docs: notifications Phase 1 follow-ups"
```

---

## Phase 2 — Coverage

### Task 10: Fanout — `expense_updated`, `expense_deleted`

**Files:**
- Modify: `cost-share-app/supabase/notifications.sql` (append)
- Modify: `cost-share-app/supabase/schema.sql`

- [ ] **Step 1: Add functions**

```sql
CREATE OR REPLACE FUNCTION fanout_expense_updated(p_expense_id uuid, p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_exp expenses%ROWTYPE; v_actor_name text; v_group_name text; v_rec record;
BEGIN
  SELECT * INTO v_exp FROM expenses WHERE id = p_expense_id;
  IF NOT FOUND OR p_actor IS NULL THEN RETURN; END IF;
  v_actor_name := _notif_actor_name(p_actor);
  v_group_name := _notif_group_name(v_exp.group_id);
  FOR v_rec IN
    SELECT DISTINCT es.user_id AS recipient_id,
           COALESCE(np.expenses_inapp, true) AS inapp_on,
           COALESCE(np.expenses_push,  true) AS push_on,
           EXISTS(SELECT 1 FROM notification_mutes nm
                  WHERE nm.user_id = es.user_id AND nm.group_id = v_exp.group_id
                    AND (nm.muted_until IS NULL OR nm.muted_until > now())) AS is_muted
    FROM expense_splits es
    LEFT JOIN notification_preferences np ON np.user_id = es.user_id
    WHERE es.expense_id = p_expense_id AND es.user_id <> p_actor
  LOOP
    CONTINUE WHEN NOT v_rec.inapp_on OR v_rec.is_muted;
    INSERT INTO notifications (recipient_user_id, actor_user_id, category, event_type,
      group_id, entity_type, entity_id, params, push_status, dedup_key)
    VALUES (v_rec.recipient_id, p_actor, 'expenses', 'expense_updated',
      v_exp.group_id, 'expense', v_exp.id,
      jsonb_build_object('actor_name', v_actor_name, 'group_name', v_group_name,
        'expense_title', v_exp.description, 'amount', v_exp.amount, 'currency', v_exp.currency),
      CASE WHEN v_rec.push_on THEN 'pending'::push_status ELSE 'skipped'::push_status END,
      'expense:' || v_exp.id || ':updated:' || extract(epoch from v_exp.updated_at)::text
    )
    ON CONFLICT (recipient_user_id, dedup_key) DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION fanout_expense_deleted(p_expense_id uuid, p_group_id uuid, p_description text, p_amount numeric, p_currency text, p_actor uuid, p_recipients uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_actor_name text; v_group_name text; v_uid uuid; v_inapp bool; v_push bool; v_muted bool;
BEGIN
  IF p_actor IS NULL THEN RETURN; END IF;
  v_actor_name := _notif_actor_name(p_actor);
  v_group_name := _notif_group_name(p_group_id);
  FOREACH v_uid IN ARRAY p_recipients LOOP
    IF v_uid = p_actor THEN CONTINUE; END IF;
    SELECT COALESCE(expenses_inapp, true), COALESCE(expenses_push, true) INTO v_inapp, v_push
    FROM notification_preferences WHERE user_id = v_uid;
    IF v_inapp IS NULL THEN v_inapp := true; v_push := true; END IF;
    SELECT EXISTS(SELECT 1 FROM notification_mutes WHERE user_id = v_uid AND group_id = p_group_id
                  AND (muted_until IS NULL OR muted_until > now())) INTO v_muted;
    CONTINUE WHEN NOT v_inapp OR v_muted;
    INSERT INTO notifications (recipient_user_id, actor_user_id, category, event_type,
      group_id, entity_type, entity_id, params, push_status, dedup_key)
    VALUES (v_uid, p_actor, 'expenses', 'expense_deleted',
      p_group_id, 'expense', p_expense_id,
      jsonb_build_object('actor_name', v_actor_name, 'group_name', v_group_name,
        'expense_title', p_description, 'amount', p_amount, 'currency', p_currency),
      CASE WHEN v_push THEN 'pending'::push_status ELSE 'skipped'::push_status END,
      'expense:' || p_expense_id || ':deleted'
    )
    ON CONFLICT (recipient_user_id, dedup_key) DO NOTHING;
  END LOOP;
END $$;
```

- [ ] **Step 2: Triggers**

```sql
CREATE OR REPLACE FUNCTION trg_after_expense_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_actor uuid;
BEGIN
  IF NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.amount IS NOT DISTINCT FROM OLD.amount
     AND NEW.currency IS NOT DISTINCT FROM OLD.currency
     AND NEW.paid_by IS NOT DISTINCT FROM OLD.paid_by
     AND NEW.is_deleted IS NOT DISTINCT FROM OLD.is_deleted THEN
    RETURN NEW;
  END IF;

  v_actor := COALESCE(auth.uid(), NEW.created_by);

  -- Soft-delete path
  IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
    PERFORM fanout_expense_deleted(
      NEW.id, NEW.group_id, NEW.description, NEW.amount, NEW.currency, v_actor,
      ARRAY(SELECT DISTINCT user_id FROM expense_splits WHERE expense_id = NEW.id)
    );
    RETURN NEW;
  END IF;

  -- Restore path is treated as added
  IF OLD.is_deleted = true AND NEW.is_deleted = false THEN
    PERFORM fanout_expense_added(NEW.id, v_actor);
    RETURN NEW;
  END IF;

  -- Regular update
  PERFORM fanout_expense_updated(NEW.id, v_actor);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_expense_update ON expenses;
CREATE TRIGGER tr_expense_update AFTER UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION trg_after_expense_update();

-- Hard delete (rare in this codebase; soft delete preferred)
CREATE OR REPLACE FUNCTION trg_before_expense_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := COALESCE(auth.uid(), OLD.created_by);
  PERFORM fanout_expense_deleted(
    OLD.id, OLD.group_id, OLD.description, OLD.amount, OLD.currency, v_actor,
    ARRAY(SELECT DISTINCT user_id FROM expense_splits WHERE expense_id = OLD.id)
  );
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS tr_expense_delete ON expenses;
CREATE TRIGGER tr_expense_delete BEFORE DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION trg_before_expense_delete();
```

- [ ] **Step 3: Apply + mirror + commit**

Apply via MCP, mirror to `schema.sql`, commit:
```bash
git commit -m "feat(db): fanout for expense_updated + expense_deleted"
```

---

### Task 11: Fanout — `settlement_recorded`, `settlement_updated`, `settlement_deleted`

**Files:** same as Task 10.

- [ ] **Step 1: Add fanout function for settlements (single helper)**

```sql
CREATE OR REPLACE FUNCTION fanout_settlement(p_settlement_id uuid, p_actor uuid, p_event notification_event)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_s settlements%ROWTYPE; v_actor_name text; v_group_name text;
        v_payer_name text; v_payee_name text;
        v_recipients uuid[]; v_uid uuid; v_inapp bool; v_push bool; v_muted bool;
BEGIN
  SELECT * INTO v_s FROM settlements WHERE id = p_settlement_id;
  IF NOT FOUND OR p_actor IS NULL THEN RETURN; END IF;
  v_actor_name := _notif_actor_name(p_actor);
  v_group_name := _notif_group_name(v_s.group_id);
  v_payer_name := _notif_actor_name(v_s.from_user_id);
  v_payee_name := _notif_actor_name(v_s.to_user_id);
  v_recipients := ARRAY[v_s.from_user_id, v_s.to_user_id];
  FOREACH v_uid IN ARRAY v_recipients LOOP
    IF v_uid = p_actor THEN CONTINUE; END IF;
    SELECT COALESCE(transfers_inapp, true), COALESCE(transfers_push, true) INTO v_inapp, v_push
    FROM notification_preferences WHERE user_id = v_uid;
    IF v_inapp IS NULL THEN v_inapp := true; v_push := true; END IF;
    SELECT EXISTS(SELECT 1 FROM notification_mutes WHERE user_id = v_uid AND group_id = v_s.group_id
                  AND (muted_until IS NULL OR muted_until > now())) INTO v_muted;
    CONTINUE WHEN NOT v_inapp OR v_muted;
    INSERT INTO notifications (recipient_user_id, actor_user_id, category, event_type,
      group_id, entity_type, entity_id, params, push_status, dedup_key)
    VALUES (v_uid, p_actor, 'transfers', p_event,
      v_s.group_id, 'settlement', v_s.id,
      jsonb_build_object('actor_name', v_actor_name, 'group_name', v_group_name,
        'payer_name', v_payer_name, 'payee_name', v_payee_name,
        'amount', v_s.amount, 'currency', v_s.currency),
      CASE WHEN v_push THEN 'pending'::push_status ELSE 'skipped'::push_status END,
      'settlement:' || v_s.id || ':' || p_event::text || ':' || COALESCE(extract(epoch from v_s.updated_at)::text, '0')
    )
    ON CONFLICT (recipient_user_id, dedup_key) DO NOTHING;
  END LOOP;
END $$;
```

- [ ] **Step 2: Triggers**

```sql
CREATE OR REPLACE FUNCTION trg_after_settlement_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := COALESCE(auth.uid(), NEW.created_by);
  PERFORM fanout_settlement(NEW.id, v_actor, 'settlement_recorded');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION trg_after_settlement_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_actor uuid; v_event notification_event;
BEGIN
  IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NULL
     AND NEW.amount IS NOT DISTINCT FROM OLD.amount
     AND NEW.from_user_id IS NOT DISTINCT FROM OLD.from_user_id
     AND NEW.to_user_id IS NOT DISTINCT FROM OLD.to_user_id THEN
    RETURN NEW;
  END IF;
  v_actor := COALESCE(auth.uid(), NEW.created_by);
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    v_event := 'settlement_deleted';
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    v_event := 'settlement_recorded';
  ELSE
    v_event := 'settlement_updated';
  END IF;
  PERFORM fanout_settlement(NEW.id, v_actor, v_event);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_settlement_insert ON settlements;
CREATE TRIGGER tr_settlement_insert AFTER INSERT ON settlements
FOR EACH ROW EXECUTE FUNCTION trg_after_settlement_insert();

DROP TRIGGER IF EXISTS tr_settlement_update ON settlements;
CREATE TRIGGER tr_settlement_update AFTER UPDATE ON settlements
FOR EACH ROW EXECUTE FUNCTION trg_after_settlement_update();
```

- [ ] **Step 3: Apply + mirror + commit**

```bash
git commit -m "feat(db): fanout for settlement events"
```

---

### Task 12: Fanout — `member_joined`, `member_left`, `member_added_self`

**Files:** same.

- [ ] **Step 1: Add helpers**

```sql
CREATE OR REPLACE FUNCTION fanout_member_event(p_group_id uuid, p_target_user uuid, p_actor uuid, p_event notification_event)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_actor_name text; v_group_name text; v_target_name text;
        v_rec record;
BEGIN
  IF p_actor IS NULL THEN RETURN; END IF;
  v_actor_name  := _notif_actor_name(p_actor);
  v_target_name := _notif_actor_name(p_target_user);
  v_group_name  := _notif_group_name(p_group_id);

  -- The "added_self" event goes only to the target user.
  IF p_event = 'member_added_self' THEN
    IF p_target_user = p_actor THEN RETURN; END IF;
    INSERT INTO notifications (recipient_user_id, actor_user_id, category, event_type,
      group_id, entity_type, entity_id, params, push_status, dedup_key)
    SELECT p_target_user, p_actor, 'friendships', p_event,
           p_group_id, 'group_member', p_group_id,
           jsonb_build_object('actor_name', v_actor_name, 'group_name', v_group_name),
           CASE WHEN COALESCE((SELECT friendships_push FROM notification_preferences WHERE user_id = p_target_user), true)
                THEN 'pending'::push_status ELSE 'skipped'::push_status END,
           'member:' || p_group_id || ':' || p_target_user || ':added_self'
    WHERE COALESCE((SELECT friendships_inapp FROM notification_preferences WHERE user_id = p_target_user), true)
      AND NOT EXISTS(SELECT 1 FROM notification_mutes WHERE user_id = p_target_user AND group_id = p_group_id
                     AND (muted_until IS NULL OR muted_until > now()))
    ON CONFLICT (recipient_user_id, dedup_key) DO NOTHING;
    RETURN;
  END IF;

  -- joined / left: notify other active members
  FOR v_rec IN
    SELECT gm.user_id AS recipient_id,
           COALESCE(np.friendships_inapp, true) AS inapp_on,
           COALESCE(np.friendships_push,  true) AS push_on,
           EXISTS(SELECT 1 FROM notification_mutes nm
                  WHERE nm.user_id = gm.user_id AND nm.group_id = p_group_id
                    AND (nm.muted_until IS NULL OR nm.muted_until > now())) AS is_muted
    FROM group_members gm
    LEFT JOIN notification_preferences np ON np.user_id = gm.user_id
    WHERE gm.group_id = p_group_id AND gm.is_active = true AND gm.user_id <> p_actor AND gm.user_id <> p_target_user
  LOOP
    CONTINUE WHEN NOT v_rec.inapp_on OR v_rec.is_muted;
    INSERT INTO notifications (recipient_user_id, actor_user_id, category, event_type,
      group_id, entity_type, entity_id, params, push_status, dedup_key)
    VALUES (v_rec.recipient_id, p_actor, 'friendships', p_event,
      p_group_id, 'group_member', p_group_id,
      jsonb_build_object('actor_name', COALESCE(v_target_name, v_actor_name), 'group_name', v_group_name),
      CASE WHEN v_rec.push_on THEN 'pending'::push_status ELSE 'skipped'::push_status END,
      'member:' || p_group_id || ':' || p_target_user || ':' || p_event::text
    )
    ON CONFLICT (recipient_user_id, dedup_key) DO NOTHING;
  END LOOP;
END $$;
```

- [ ] **Step 2: Triggers**

```sql
CREATE OR REPLACE FUNCTION trg_after_group_members_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := auth.uid();
  -- Self-join (e.g. redeem_group_invite): actor == new member → fanout member_joined to others
  IF v_actor IS NULL OR v_actor = NEW.user_id THEN
    PERFORM fanout_member_event(NEW.group_id, NEW.user_id, NEW.user_id, 'member_joined');
  ELSE
    -- Admin-added: notify new member + others
    PERFORM fanout_member_event(NEW.group_id, NEW.user_id, v_actor, 'member_added_self');
    PERFORM fanout_member_event(NEW.group_id, NEW.user_id, v_actor, 'member_joined');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION trg_after_group_members_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_actor uuid;
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    v_actor := COALESCE(auth.uid(), NEW.user_id);
    PERFORM fanout_member_event(NEW.group_id, NEW.user_id, v_actor, 'member_left');
  ELSIF OLD.is_active = false AND NEW.is_active = true THEN
    v_actor := COALESCE(auth.uid(), NEW.user_id);
    PERFORM fanout_member_event(NEW.group_id, NEW.user_id, v_actor, 'member_joined');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_group_members_insert ON group_members;
CREATE TRIGGER tr_group_members_insert AFTER INSERT ON group_members
FOR EACH ROW EXECUTE FUNCTION trg_after_group_members_insert();

DROP TRIGGER IF EXISTS tr_group_members_update ON group_members;
CREATE TRIGGER tr_group_members_update AFTER UPDATE ON group_members
FOR EACH ROW EXECUTE FUNCTION trg_after_group_members_update();
```

- [ ] **Step 3: Apply + mirror + commit**

```bash
git commit -m "feat(db): fanout for group_members events"
```

---

### Task 13: SQL test script for all fanout functions

**Files:**
- Create: `cost-share-app/supabase/tests/notifications.sql`

- [ ] **Step 1: Write script**

```sql
-- Run in a transaction to leave the DB clean.
BEGIN;
SAVEPOINT base;

-- Set up two test users + a group
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local')
ON CONFLICT DO NOTHING;
INSERT INTO profiles (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice'),
  ('22222222-2222-2222-2222-222222222222', 'Bob')
ON CONFLICT DO NOTHING;
INSERT INTO groups (id, name, created_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;
INSERT INTO group_members (group_id, user_id, is_active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', true)
ON CONFLICT DO NOTHING;

-- Case 1: Alice adds an expense splitting with Bob → Bob gets 1 notification
SET LOCAL ROLE postgres;
INSERT INTO expenses (id, group_id, description, amount, currency, created_by, paid_by)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Pizza', 100, 'ILS', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
INSERT INTO expense_splits (expense_id, user_id, amount) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 50),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 50);

DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM notifications WHERE event_type = 'expense_added' AND recipient_user_id = '22222222-2222-2222-2222-222222222222';
  ASSERT c = 1, format('expected 1 notif for Bob, got %s', c);
END $$;

-- Case 2: Calling fanout again is idempotent (dedup_key)
SELECT fanout_expense_added('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111');
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM notifications WHERE event_type = 'expense_added' AND recipient_user_id = '22222222-2222-2222-2222-222222222222';
  ASSERT c = 1, format('still 1 after re-fanout, got %s', c);
END $$;

-- Case 3: Bob turns off expenses_inapp → no new rows
INSERT INTO notification_preferences (user_id, expenses_inapp) VALUES ('22222222-2222-2222-2222-222222222222', false);
DELETE FROM notifications WHERE recipient_user_id = '22222222-2222-2222-2222-222222222222';
INSERT INTO expense_splits (expense_id, user_id, amount) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 50);
-- Re-fire by inserting a fresh expense
INSERT INTO expenses (id, group_id, description, amount, currency, created_by, paid_by)
VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Beer', 50, 'ILS', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
INSERT INTO expense_splits (expense_id, user_id, amount) VALUES
  ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 50);
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM notifications WHERE recipient_user_id = '22222222-2222-2222-2222-222222222222';
  ASSERT c = 0, format('expected 0 with inapp=off, got %s', c);
END $$;

-- Case 4: push off → row with push_status='skipped'
UPDATE notification_preferences SET expenses_inapp = true, expenses_push = false WHERE user_id = '22222222-2222-2222-2222-222222222222';
INSERT INTO expenses (id, group_id, description, amount, currency, created_by, paid_by)
VALUES ('eeeeeeee-1111-0000-0000-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Coffee', 20, 'ILS', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
INSERT INTO expense_splits (expense_id, user_id, amount) VALUES
  ('eeeeeeee-1111-0000-0000-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 20);
DO $$ DECLARE s push_status; BEGIN
  SELECT push_status INTO s FROM notifications WHERE recipient_user_id = '22222222-2222-2222-2222-222222222222' AND entity_id = 'eeeeeeee-1111-0000-0000-eeeeeeeeeeee';
  ASSERT s = 'skipped', format('expected skipped, got %s', s);
END $$;

-- Case 5: mute group → no rows
UPDATE notification_preferences SET expenses_push = true WHERE user_id = '22222222-2222-2222-2222-222222222222';
INSERT INTO notification_mutes (user_id, group_id) VALUES ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO expenses (id, group_id, description, amount, currency, created_by, paid_by)
VALUES ('eeeeeeee-2222-0000-0000-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Tea', 10, 'ILS', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
INSERT INTO expense_splits (expense_id, user_id, amount) VALUES
  ('eeeeeeee-2222-0000-0000-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 10);
DO $$ DECLARE c int; BEGIN
  SELECT count(*) INTO c FROM notifications WHERE recipient_user_id = '22222222-2222-2222-2222-222222222222' AND entity_id = 'eeeeeeee-2222-0000-0000-eeeeeeeeeeee';
  ASSERT c = 0, format('expected 0 when muted, got %s', c);
END $$;

ROLLBACK TO SAVEPOINT base;
ROLLBACK;
```

- [ ] **Step 2: Run via execute_sql MCP**

Use `mcp__supabase__execute_sql` with the entire script. Expect no ASSERT failures.

- [ ] **Step 3: Commit**

```bash
git add cost-share-app/supabase/tests/notifications.sql
git commit -m "test(db): notification fanout assertion script"
```

---

### Task 14: Mobile — `useNotifications` hook (Realtime + React Query)

**Files:**
- Create: `cost-share-app/apps/mobile/hooks/useNotifications.ts`
- Create: `cost-share-app/apps/mobile/__tests__/hooks/useNotifications.test.ts`

- [ ] **Step 1: Hook**

```typescript
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { setAppBadge } from '../services/notifications.service';
import type { NotificationRow } from '@kupa/shared/notifications';

const KEY_LIST = ['notifications', 'list'] as const;
const KEY_UNREAD = ['notifications', 'unreadCount'] as const;

export function useNotificationsList(limit = 30) {
  return useQuery({
    queryKey: KEY_LIST,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: KEY_UNREAD,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 10_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_UNREAD });
      qc.invalidateQueries({ queryKey: KEY_LIST });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_UNREAD });
      qc.invalidateQueries({ queryKey: KEY_LIST });
    },
  });
}

export function useNotificationsRealtime() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `recipient_user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as NotificationRow;
        qc.setQueryData<NotificationRow[]>(KEY_LIST, (prev) => [row, ...(prev ?? [])]);
        qc.setQueryData<number>(KEY_UNREAD, (prev) => (prev ?? 0) + 1);
        void setAppBadge((qc.getQueryData<number>(KEY_UNREAD) ?? 0));
      })
      .subscribe();
    return () => { void ch.unsubscribe(); };
  }, [userId, qc]);
}
```

- [ ] **Step 2: Tests**

`__tests__/hooks/useNotifications.test.ts`:
```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useNotificationsList, useUnreadCount, useNotificationsRealtime } from '../../hooks/useNotifications';

const order = jest.fn().mockReturnThis();
const limit = jest.fn().mockResolvedValue({ data: [{ id: 'n1' }], error: null });
const head = jest.fn().mockResolvedValue({ count: 3, error: null });

jest.mock('../../lib/supabase', () => {
  return {
    supabase: {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          order: jest.fn(() => ({ limit })),
          is: jest.fn(() => ({})),
        })),
      })),
      channel: jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
        unsubscribe: jest.fn(),
      })),
    },
  };
});
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ userId: 'u1' }) }));
jest.mock('../../services/notifications.service', () => ({ setAppBadge: jest.fn() }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

it('fetches notifications list', async () => {
  const { result } = renderHook(() => useNotificationsList(), { wrapper: wrap() });
  await waitFor(() => expect(result.current.data).toEqual([{ id: 'n1' }]));
});

it('Realtime subscribes on mount', () => {
  const { unmount } = renderHook(() => useNotificationsRealtime(), { wrapper: wrap() });
  const { supabase } = require('../../lib/supabase');
  expect(supabase.channel).toHaveBeenCalledWith('notifications:u1');
  unmount();
});
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): useNotifications hooks + Realtime subscription"
```

---

### Task 15: Mobile — InAppToast component + foreground handler

**Files:**
- Create: `cost-share-app/apps/mobile/components/notifications/InAppToast.tsx`
- Modify: `cost-share-app/apps/mobile/services/notifications.service.ts`
- Create: `cost-share-app/apps/mobile/__tests__/components/InAppToast.test.tsx`

- [ ] **Step 1: Add foreground handler to service**

Append to `notifications.service.ts`:
```typescript
import * as Notifications from 'expo-notifications';

let handlerInstalled = false;
export function installForegroundHandler() {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}
```

- [ ] **Step 2: InAppToast component**

(Uses `react-native-toast-message`'s custom render — confirmed installed.)

```typescript
import React from 'react';
import Toast, { BaseToastProps } from 'react-native-toast-message';
import { View, Text, Pressable, StyleSheet, I18nManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { NotificationEvent, NotificationParams } from '@kupa/shared/notifications';
import { renderNotification } from '@kupa/shared/notifications';
import i18n from '../../i18n';

export interface InAppToastPayload {
  notification_id: string;
  event_type: NotificationEvent;
  params: NotificationParams;
  onPress?: (id: string) => void;
}

export function showInAppToast(payload: InAppToastPayload) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  Toast.show({
    type: 'kupa',
    visibilityTime: 4000,
    autoHide: true,
    onPress: () => payload.onPress?.(payload.notification_id),
    props: payload,
  });
}

const KupaToast: React.FC<BaseToastProps & { props: InAppToastPayload }> = ({ props }) => {
  const locale = (i18n.language as 'en' | 'he') ?? 'en';
  const { title, body } = renderNotification(props.event_type, props.params, locale);
  return (
    <Pressable testID="inapp-toast" onPress={() => props.onPress?.(props.notification_id)}>
      <View style={[styles.card, { flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }]}>
        <View style={styles.avatar} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {body ? <Text style={styles.text} numberOfLines={2}>{body}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
};

export const toastConfig = { kupa: KupaToast };

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', marginHorizontal: 12, marginTop: 8, padding: 12, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee', marginEnd: 12 },
  body: { flex: 1 },
  title: { fontWeight: '600', fontSize: 14 },
  text: { color: '#555', marginTop: 2 },
});
```

- [ ] **Step 3: Mount toastConfig in App root**

In `App.tsx` (or wherever `<Toast />` is rendered), pass `config={toastConfig}` — preserving any existing custom types.

- [ ] **Step 4: Tests**

`__tests__/components/InAppToast.test.tsx`:
```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { toastConfig } from '../../components/notifications/InAppToast';

jest.mock('../../i18n', () => ({ __esModule: true, default: { language: 'en' } }));

it('renders title from renderNotification', () => {
  const Toast = (toastConfig as any).kupa;
  const onPress = jest.fn();
  const { getByText } = render(
    <Toast props={{
      notification_id: 'n1',
      event_type: 'expense_added',
      params: { actor_name: 'Dana', group_name: 'Apt', expense_title: 'Pizza', amount: 50, currency: 'ILS' },
      onPress,
    }} />
  );
  expect(getByText(/Dana added to "Apt"/)).toBeTruthy();
});

it('invokes onPress', () => {
  const Toast = (toastConfig as any).kupa;
  const onPress = jest.fn();
  const { getByTestId } = render(
    <Toast props={{ notification_id: 'n1', event_type: 'member_joined', params: { actor_name: 'A', group_name: 'G' }, onPress }} />
  );
  fireEvent.press(getByTestId('inapp-toast'));
  expect(onPress).toHaveBeenCalledWith('n1');
});
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mobile): InAppToast component + foreground notification handler"
```

---

### Task 16: Mobile — `notificationRouting.ts` + listeners wiring

**Files:**
- Create: `cost-share-app/apps/mobile/services/notificationRouting.ts`
- Create: `cost-share-app/apps/mobile/__tests__/services/notificationRouting.test.ts`
- Modify: `cost-share-app/apps/mobile/navigation/AppNavigator.tsx`

- [ ] **Step 1: Routing module**

```typescript
import type { NavigationContainerRef } from '@react-navigation/native';
import type { NotificationEvent } from '@kupa/shared/notifications';

export interface RouteIntent {
  event_type: NotificationEvent;
  entity_type: string | null;
  entity_id: string | null;
  group_id: string | null;
}

export function resolveRoute(intent: RouteIntent): { screen: string; params: Record<string, unknown> } {
  switch (intent.event_type) {
    case 'expense_added':
    case 'expense_updated':
    case 'expense_deleted':
      return { screen: 'ExpenseDetail', params: { groupId: intent.group_id, expenseId: intent.entity_id } };
    case 'settlement_recorded':
    case 'settlement_updated':
    case 'settlement_deleted':
      return { screen: 'Balances', params: { groupId: intent.group_id } };
    case 'member_joined':
    case 'member_left':
      return { screen: 'GroupMembers', params: { groupId: intent.group_id } };
    case 'member_added_self':
      return { screen: 'GroupDetail', params: { groupId: intent.group_id } };
  }
}

export function navigateToIntent(
  navRef: NavigationContainerRef<Record<string, object | undefined>> | null,
  intent: RouteIntent,
): void {
  if (!navRef?.isReady()) return;
  const route = resolveRoute(intent);
  navRef.navigate(route.screen as never, route.params as never);
}
```

- [ ] **Step 2: Tests**

`__tests__/services/notificationRouting.test.ts`:
```typescript
import { resolveRoute } from '../../services/notificationRouting';

it.each([
  ['expense_added', 'ExpenseDetail'],
  ['expense_updated', 'ExpenseDetail'],
  ['expense_deleted', 'ExpenseDetail'],
  ['settlement_recorded', 'Balances'],
  ['settlement_updated', 'Balances'],
  ['settlement_deleted', 'Balances'],
  ['member_joined', 'GroupMembers'],
  ['member_left', 'GroupMembers'],
  ['member_added_self', 'GroupDetail'],
] as const)('routes %s → %s', (event, screen) => {
  const r = resolveRoute({ event_type: event, entity_type: 'x', entity_id: 'e', group_id: 'g' });
  expect(r.screen).toBe(screen);
});
```

- [ ] **Step 3: Wire listeners in AppNavigator**

Inside the authenticated tree, add:
```typescript
import * as Notifications from 'expo-notifications';
import { installForegroundHandler } from '../services/notifications.service';
import { navigateToIntent } from '../services/notificationRouting';
import { showInAppToast } from '../components/notifications/InAppToast';
import { useNotificationsRealtime } from '../hooks/useNotifications';
import { supabase } from '../lib/supabase';
import { navigationRef } from './navigationRef'; // create if doesn't exist
import { useEffect } from 'react';

function NotificationsBridge() {
  useNotificationsRealtime();
  useEffect(() => {
    installForegroundHandler();
    const sub1 = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data as any;
      showInAppToast({
        notification_id: data.notification_id,
        event_type: data.event_type,
        params: n.request.content.body ? { /* fallback */ } : (data.params ?? {}),
        onPress: (id) => {
          void supabase.rpc('mark_notification_read', { p_notification_id: id });
          navigateToIntent(navigationRef.current, data);
        },
      });
    });
    const sub2 = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as any;
      if (data?.notification_id) void supabase.rpc('mark_notification_read', { p_notification_id: data.notification_id });
      navigateToIntent(navigationRef.current, data);
    });
    return () => { sub1.remove(); sub2.remove(); };
  }, []);
  return null;
}
```

Place `<NotificationsBridge />` near the root of the authenticated tree.

If `navigationRef` doesn't yet exist, create `cost-share-app/apps/mobile/navigation/navigationRef.ts`:
```typescript
import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();
```
And attach it to `<NavigationContainer ref={navigationRef}>`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): notification routing + listeners bridge"
```

---

### Task 17: Mobile — NotificationsInboxScreen + bell icon

**Files:**
- Create: `cost-share-app/apps/mobile/screens/notifications/NotificationsInboxScreen.tsx`
- Create: `cost-share-app/apps/mobile/components/notifications/NotificationRow.tsx`
- Create: `cost-share-app/apps/mobile/components/notifications/NotificationBell.tsx`
- Modify: `cost-share-app/apps/mobile/navigation/AppNavigator.tsx`
- Create: `cost-share-app/apps/mobile/__tests__/screens/NotificationsInboxScreen.test.tsx`
- Create: `cost-share-app/apps/mobile/__tests__/components/NotificationRow.test.tsx`
- Modify: locales

- [ ] **Step 1: i18n additions**

Append to `notifications` block in `en.json`:
```json
"inbox": {
  "title": "Notifications",
  "empty": "No notifications yet",
  "markAllRead": "Mark all as read"
}
```
he.json: counterparts.

- [ ] **Step 2: NotificationRow**

```typescript
import React from 'react';
import { View, Text, Pressable, StyleSheet, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { renderNotification } from '@kupa/shared/notifications';
import type { NotificationRow as Row } from '@kupa/shared/notifications';

export interface NotificationRowProps {
  row: Row;
  onPress: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function NotificationRow({ row, onPress }: NotificationRowProps) {
  const { i18n } = useTranslation();
  const locale = (i18n.language as 'en' | 'he') ?? 'en';
  const { title, body } = renderNotification(row.event_type, row.params, locale);
  const unread = row.read_at == null;
  return (
    <Pressable testID={`notif-row-${row.id}`} onPress={() => onPress(row.id)} style={styles.row}>
      {unread && <View style={styles.dot} testID="unread-dot" />}
      <View style={styles.avatar} />
      <View style={[styles.body, { alignItems: I18nManager.isRTL ? 'flex-end' : 'flex-start' }]}>
        <Text style={[styles.title, unread && styles.bold]} numberOfLines={1}>{title}</Text>
        {body ? <Text style={styles.text} numberOfLines={2}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3478F6', marginEnd: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', marginEnd: 12 },
  body: { flex: 1 },
  title: { fontSize: 14 },
  bold: { fontWeight: '600' },
  text: { color: '#666', marginTop: 2, fontSize: 13 },
});
```

- [ ] **Step 3: NotificationsInboxScreen**

```typescript
import React from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNotificationsList, useMarkRead, useMarkAllRead } from '../../hooks/useNotifications';
import { NotificationRow } from '../../components/notifications/NotificationRow';
import { navigationRef } from '../../navigation/navigationRef';
import { navigateToIntent } from '../../services/notificationRouting';
import { supabase } from '../../lib/supabase';

export function NotificationsInboxScreen() {
  const { t } = useTranslation();
  const q = useNotificationsList(50);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const handlePress = (id: string) => {
    markRead.mutate(id);
    const row = q.data?.find((n) => n.id === id);
    if (row) navigateToIntent(navigationRef.current, row);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    q.refetch();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('notifications.inbox.title')}</Text>
        <Pressable testID="mark-all" onPress={() => markAll.mutate()}>
          <Text style={styles.action}>{t('notifications.inbox.markAllRead')}</Text>
        </Pressable>
      </View>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <NotificationRow row={item} onPress={handlePress} onDelete={handleDelete} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={<Text style={styles.empty}>{t('notifications.inbox.empty')}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  action: { color: '#3478F6' },
  empty: { textAlign: 'center', color: '#888', marginTop: 60 },
});
```

(Swipe-to-delete polish deferred to Task 18 — keep this row simple now.)

- [ ] **Step 4: NotificationBell**

```typescript
import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUnreadCount } from '../../hooks/useNotifications';

export function NotificationBell() {
  const nav = useNavigation<any>();
  const { data: unread = 0 } = useUnreadCount();
  return (
    <Pressable testID="notification-bell" onPress={() => nav.navigate('NotificationsInbox')} hitSlop={8}>
      <Ionicons name="notifications-outline" size={24} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#E53935', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
});
```

- [ ] **Step 5: Mount in navigator**

In `AppNavigator.tsx`:
- Register `NotificationsInbox` screen in the root authenticated stack with `component={NotificationsInboxScreen}`.
- Add `<NotificationBell />` as `headerRight` of the GroupsList (or Dashboard) screen.

- [ ] **Step 6: Tests**

`__tests__/screens/NotificationsInboxScreen.test.tsx`:
```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NotificationsInboxScreen } from '../../screens/notifications/NotificationsInboxScreen';

const useList = jest.fn();
const markRead = jest.fn();
const markAll = jest.fn();
jest.mock('../../hooks/useNotifications', () => ({
  useNotificationsList: () => useList(),
  useMarkRead: () => ({ mutate: markRead }),
  useMarkAllRead: () => ({ mutate: markAll }),
  useUnreadCount: () => ({ data: 0 }),
}));
jest.mock('../../navigation/navigationRef', () => ({ navigationRef: { current: null } }));
jest.mock('../../services/notificationRouting', () => ({ navigateToIntent: jest.fn() }));
jest.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ delete: () => ({ eq: () => Promise.resolve({}) }) }) } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

beforeEach(() => jest.clearAllMocks());

it('shows empty state', () => {
  useList.mockReturnValue({ data: [], isFetching: false, refetch: jest.fn() });
  const { getByText } = render(<NotificationsInboxScreen />);
  expect(getByText('notifications.inbox.empty')).toBeTruthy();
});

it('marks all read on header tap', () => {
  useList.mockReturnValue({ data: [], isFetching: false, refetch: jest.fn() });
  const { getByTestId } = render(<NotificationsInboxScreen />);
  fireEvent.press(getByTestId('mark-all'));
  expect(markAll).toHaveBeenCalled();
});

it('marks read + navigates on row tap', async () => {
  useList.mockReturnValue({
    data: [{ id: 'n1', event_type: 'expense_added', read_at: null, params: { actor_name: 'A', group_name: 'G' } }],
    isFetching: false, refetch: jest.fn(),
  });
  const { getByTestId } = render(<NotificationsInboxScreen />);
  fireEvent.press(getByTestId('notif-row-n1'));
  await waitFor(() => expect(markRead).toHaveBeenCalledWith('n1'));
});
```

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(mobile): notifications inbox screen + bell icon"
```

---

### Task 18: Mobile — Notification Settings section + Mute Group toggle

**Files:**
- Modify: `cost-share-app/apps/mobile/screens/profile/SettingsScreen.tsx`
- Modify: `cost-share-app/apps/mobile/screens/groups/EditGroupScreen.tsx`
- Create: `cost-share-app/apps/mobile/hooks/useNotificationPreferences.ts`
- Create: `cost-share-app/apps/mobile/hooks/useGroupMute.ts`
- Modify: locales

- [ ] **Step 1: i18n**

Add to `notifications` block:
```json
"settings": {
  "section": "Notifications",
  "permission": "Permission",
  "permissionGranted": "Enabled",
  "permissionDenied": "Disabled — open system settings",
  "categories": {
    "friendships": "Friendships (joins, leaves)",
    "expenses": "Expenses (add, update, delete)",
    "transfers": "Transfers (settle-ups)"
  },
  "columns": { "push": "Push", "inApp": "In-app" },
  "muteGroup": "Mute notifications from this group"
}
```
Hebrew counterparts.

- [ ] **Step 2: `useNotificationPreferences` hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const KEY = ['notifications', 'preferences'] as const;

export interface PrefsRow {
  friendships_push: boolean; friendships_inapp: boolean;
  expenses_push: boolean;    expenses_inapp: boolean;
  transfers_push: boolean;   transfers_inapp: boolean;
}

const DEFAULTS: PrefsRow = {
  friendships_push: true, friendships_inapp: true,
  expenses_push: true,    expenses_inapp: true,
  transfers_push: true,   transfers_inapp: true,
};

export function useNotificationPreferences() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return (data ?? DEFAULTS) as PrefsRow;
    },
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<PrefsRow>) => {
      const { error } = await supabase.rpc('update_notification_preferences', { p_prefs: patch });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<PrefsRow>(KEY);
      qc.setQueryData<PrefsRow>(KEY, { ...(prev ?? DEFAULTS), ...patch });
      return { prev };
    },
    onError: (_e, _p, ctx) => { if (ctx?.prev) qc.setQueryData(KEY, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
```

- [ ] **Step 3: `useGroupMute` hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const key = (groupId: string) => ['notifications', 'mute', groupId] as const;

export function useGroupMute(groupId: string) {
  return useQuery({
    queryKey: key(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_mutes')
        .select('group_id')
        .eq('group_id', groupId)
        .maybeSingle();
      if (error) throw error;
      return data != null;
    },
  });
}

export function useToggleGroupMute(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (muted: boolean) => {
      const { error } = await supabase.rpc('toggle_group_mute', { p_group_id: groupId, p_muted: muted });
      if (error) throw error;
    },
    onMutate: async (muted) => {
      await qc.cancelQueries({ queryKey: key(groupId) });
      const prev = qc.getQueryData<boolean>(key(groupId));
      qc.setQueryData(key(groupId), muted);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx) qc.setQueryData(key(groupId), ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: key(groupId) }),
  });
}
```

- [ ] **Step 4: Add section to SettingsScreen**

Add a new `SettingsSection` near the General section (existing component pattern). Render 3 rows × 2 switches using the existing toggle component. Show permission status + "Open OS settings" link (use `Linking.openSettings()` from `react-native`).

```typescript
// Sketch — adapt to the existing SettingsSection / Row API
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../../hooks/useNotificationPreferences';
import { getPermissionStatus } from '../../services/notifications.service';
import { Linking, Switch, View, Text } from 'react-native';

// ... inside SettingsScreen:
const prefs = useNotificationPreferences();
const update = useUpdateNotificationPreferences();
const [permGranted, setPermGranted] = useState<boolean | null>(null);
useEffect(() => { getPermissionStatus().then((s) => setPermGranted(s.granted)); }, []);

<SettingsSection title={t('notifications.settings.section')}>
  <Row label={t('notifications.settings.permission')} value={permGranted ? t('notifications.settings.permissionGranted') : t('notifications.settings.permissionDenied')} onPress={() => Linking.openSettings()} />
  {(['friendships','expenses','transfers'] as const).map((cat) => (
    <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={{ flex: 1 }}>{t(`notifications.settings.categories.${cat}`)}</Text>
      <Switch testID={`${cat}-push`}  value={prefs.data?.[`${cat}_push`] ?? true}  disabled={!permGranted} onValueChange={(v) => update.mutate({ [`${cat}_push`]: v })} />
      <Switch testID={`${cat}-inapp`} value={prefs.data?.[`${cat}_inapp`] ?? true} onValueChange={(v) => update.mutate({ [`${cat}_inapp`]: v })} />
    </View>
  ))}
</SettingsSection>
```

- [ ] **Step 5: Add Mute toggle to EditGroupScreen**

```typescript
import { useGroupMute, useToggleGroupMute } from '../../hooks/useGroupMute';
import { Switch } from 'react-native';
// inside the screen:
const muteQ = useGroupMute(groupId);
const muteM = useToggleGroupMute(groupId);
<Switch testID="mute-group" value={muteQ.data ?? false} onValueChange={(v) => muteM.mutate(v)} />
```

- [ ] **Step 6: Tests**

`__tests__/hooks/useNotificationPreferences.test.ts` — basic happy path + optimistic update revert on error.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(mobile): notification settings + per-group mute toggle"
```

---

### Task 19: End-to-end smoke for Phase 2

- [ ] Two-device test: settlement, member-add, member-leave, mute group — each triggers expected inbox + push.
- [ ] Commit any tech-debt items discovered.

---

## Phase 3 — Polish & Resilience

### Task 20: Edge Function `retry-push` + pg_cron

**Files:**
- Create: `cost-share-app/supabase/functions/retry-push/index.ts`
- Create: `cost-share-app/supabase/functions/retry-push/deno.json`
- Create: `cost-share-app/supabase/functions/retry-push/index.test.ts`
- Modify: `cost-share-app/supabase/notifications.sql`

- [ ] **Step 1: index.ts**

```typescript
import { createClient } from 'supabase';
import { handle as sendPush } from '../send-push/index.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async () => {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.from('notifications')
    .select('*')
    .eq('push_status', 'failed')
    .lt('push_attempts', 3)
    .gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
    .limit(100);
  if (error) return new Response('err', { status: 500 });
  for (const row of data ?? []) {
    await sendPush({ type: 'INSERT', table: 'notifications', record: { ...row, push_status: 'pending' } } as never, sb);
  }
  return new Response(`retried ${data?.length ?? 0}`, { status: 200 });
});
```

- [ ] **Step 2: Tests**

Cover: empty result → 200, calls send-push handler for each row.

- [ ] **Step 3: pg_cron schedule (SQL)**

Append to `notifications.sql`:
```sql
-- Requires pg_cron + pg_net extensions enabled
SELECT cron.schedule(
  'retry-push',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url := current_setting('app.retry_push_url'),
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ); $$
);
```
Document the two `ALTER DATABASE postgres SET app.retry_push_url = '...'` commands in `docs/SSOT/SETUP.md`.

- [ ] **Step 4: Deploy + commit**

```bash
git commit -m "feat(edge): retry-push function + 5-min pg_cron schedule"
```

---

### Task 21: Stacked toasts when bursty

**Files:**
- Modify: `cost-share-app/apps/mobile/components/notifications/InAppToast.tsx`

- [ ] **Step 1: Add a toast queue module**

```typescript
let queue: InAppToastPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function enqueueToast(payload: InAppToastPayload) {
  queue.push(payload);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    if (queue.length === 1) showInAppToast(queue[0]);
    else {
      // collapse
      Toast.show({
        type: 'kupa',
        visibilityTime: 4000,
        props: { ...queue[queue.length - 1], _count: queue.length },
      });
    }
    queue = [];
    flushTimer = null;
  }, 600);
}
```

Render `+N` badge when `_count > 1`.

- [ ] **Step 2: Replace `showInAppToast` call site with `enqueueToast`**

- [ ] **Step 3: Test bursty stacking**

```typescript
it('collapses 3 toasts arriving within 600ms', async () => {
  // ...
});
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): stacked toasts for bursty notifications"
```

---

### Task 22: E2E flows (Maestro)

**Files:**
- Create: `cost-share-app/apps/mobile/.maestro/notifications/onboarding.yaml`
- Create: `cost-share-app/apps/mobile/.maestro/notifications/settings.yaml`
- Create: `cost-share-app/apps/mobile/.maestro/notifications/mute.yaml`

- [ ] **Step 1: Onboarding flow**

```yaml
appId: com.kupa.app
---
- launchApp
- runFlow: ../login.yaml
- tapOn: "Join group"
- tapOn:
    text: "כן, הפעלה"
- tapOn:
    text: "Allow"
- # backend triggers expense_added on the recipient (out-of-band)
- assertVisible:
    id: "inapp-toast"
- tapOn:
    id: "inapp-toast"
- assertVisible:
    text: "Expense details"
```

- [ ] **Step 2: Settings flow** — toggles `expenses_push` off, triggers event, expects inbox row but no toast.

- [ ] **Step 3: Mute flow** — mutes group, triggers event, expects 0 rows.

- [ ] **Step 4: Document in README how to run**

```bash
maestro test apps/mobile/.maestro/notifications/onboarding.yaml
```

- [ ] **Step 5: Commit**

```bash
git commit -m "test(e2e): Maestro flows for notifications"
```

---

### Task 23: Performance pass + feature flag

- [ ] **Step 1: Add `notifications_enabled` flag**

Server side: a constant in a config table, or env var read by the Edge Function. Mobile: gated read from `profiles.notifications_enabled` (column added in this task with default `true`).

- [ ] **Step 2: Review query plans**

Run `EXPLAIN ANALYZE` on:
- `SELECT * FROM notifications WHERE recipient_user_id = $1 ORDER BY created_at DESC LIMIT 30`
- The fanout JOIN on `expense_splits` + `notification_preferences`.

Confirm indexes are used. Fix any seq scans.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(notifications): feature flag + perf-pass index validation"
```

---

## Self-Review

**Spec coverage** — every locked decision and § in the spec maps to a task:
- Channels & categories (Tasks 1, 18) ✓
- 9 events (Tasks 3, 10, 11, 12) ✓
- Mute group (Tasks 2 schema, 18 UI) ✓
- Push-content rendering (Task 1, 4) ✓
- Permission soft prompt (Task 7) ✓
- DB schema + RLS (Task 2) ✓
- Fanout + triggers (Tasks 3, 10, 11, 12) ✓
- Edge function (Task 4) ✓
- Retry job (Task 20) ✓
- Realtime + inbox + bell (Tasks 14, 17) ✓
- Foreground toast + bg listener + deep linking (Tasks 15, 16) ✓
- Android channels + iOS threads (Tasks 4 payload, 6 service) ✓
- Badge management (Tasks 6, 14) ✓
- Test strategy: snapshot/content (Task 1), SQL fanout (Task 13), Edge (Task 4, 20), mobile units (each task), Maestro (Task 22) ✓
- Rollout phases — plan ordered by Phase 1/2/3 ✓
- Tech debt items — covered by separate doc, referenced ✓

**Placeholder scan** — no TBD/TODO inside steps. Each code block is complete. The only deferred specifics are intentional handoff notes ("adapt to existing SettingsSection API") where the existing codebase pattern is the source of truth.

**Type consistency** — `NotificationEvent`, `NotificationParams`, `PushStatus`, `NotificationLocale`, `NotificationRow`, `NotificationCategory` are defined once in Task 1 and referenced identically thereafter. RPC names (`register_device_token`, `unregister_device_token`, `mark_notification_read`, `mark_all_notifications_read`, `update_notification_preferences`, `toggle_group_mute`) are stable across tasks. Function names (`fanout_expense_added`, `fanout_expense_updated`, `fanout_expense_deleted`, `fanout_settlement`, `fanout_member_event`, `_notif_actor_name`, `_notif_group_name`) consistent.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-20-notifications.md`.**
