# Profile FX Edge Function Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move profile currency-rate fetching from the mobile client to a Supabase Edge Function with a shared Postgres cache, so all users share at most one upstream API call per base currency per 24 hours.

**Architecture:** Mobile keeps balance math in `packages/shared` (`aggregateBalanceInBaseCurrency`). Supabase stores cached rate tables in `fx_rate_snapshots`. Edge Function `exchange-rates` (JWT required) returns `{ date, rates }` for requested symbols; on cache miss it calls open.er-api.com once, upserts the full base snapshot, then slices requested symbols. Mobile adds a second-layer AsyncStorage cache to avoid redundant function invocations.

**Tech Stack:** Supabase Edge Functions (Deno), Postgres, `@supabase/supabase-js` in mobile, open.er-api.com upstream, existing React Query + `useProfileBalanceSummary`.

**Mapped SRS:** REQ-PROF-07 (extend), REQ-NFR-04 (RLS — cache table not client-readable).

---

## File map

| File | Responsibility |
|------|----------------|
| `cost-share-app/supabase/fx-rate-cache.sql` | `fx_rate_snapshots` table + RLS lockdown |
| `cost-share-app/supabase/config.toml` | Edge function config (`verify_jwt = true`) |
| `cost-share-app/supabase/functions/exchange-rates/index.ts` | Edge Function: cache read/write + upstream fetch |
| `cost-share-app/apps/mobile/services/exchangeRates.service.ts` | Call `supabase.functions.invoke` instead of direct HTTP |
| `cost-share-app/apps/mobile/__tests__/services/exchangeRates.service.test.ts` | Mock `supabase.functions.invoke` |
| `cost-share-app/apps/mobile/.env.example` | Document deploy step |
| `docs/SSOT/SRS.md` | Update REQ-PROF-07 acceptance criteria |

---

## Why this is efficient

| Layer | Before (client-only) | After (edge + DB) |
|-------|----------------------|-------------------|
| Upstream API | 1 call per user per 24h per currency set | 1 call per **base currency** per 24h for **all users** |
| CORS / Web | Depends on third-party `Access-Control-Allow-Origin` | Supabase function URL — always allowed |
| Abuse risk | Anyone can hit open.er-api from browser | JWT required on function |
| Mobile work | Unchanged — still aggregates on device | Unchanged |

---

### Task 0: Add shared FX cache table

**Files:**
- Create: `cost-share-app/supabase/fx-rate-cache.sql`
- Modify: `cost-share-app/supabase/schema.sql` (append same block at end for greenfield installs)

- [ ] **Step 1: Create SQL file**

```sql
-- Idempotent: shared FX cache for profile dashboard (REQ-PROF-07)
-- Apply: supabase db query --linked -f supabase/fx-rate-cache.sql

CREATE TABLE IF NOT EXISTS fx_rate_snapshots (
    base_code VARCHAR(3) PRIMARY KEY,
    rates JSONB NOT NULL,
    rate_date DATE NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fx_rate_snapshots ENABLE ROW LEVEL SECURITY;
-- No policies: clients cannot read/write; Edge Function uses service role only.

CREATE INDEX IF NOT EXISTS idx_fx_rate_snapshots_fetched_at
    ON fx_rate_snapshots (fetched_at);
```

- [ ] **Step 2: Apply to linked project**

Run:
```bash
cd cost-share-app
supabase db query --linked -f supabase/fx-rate-cache.sql
```
Expected: `Success` (or "already exists" on re-run).

- [ ] **Step 3: Append identical block to end of `supabase/schema.sql`**

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/supabase/fx-rate-cache.sql cost-share-app/supabase/schema.sql
git commit -m "feat(supabase): add fx_rate_snapshots cache table for profile FX"
```

---

### Task 1: Scaffold Edge Function

**Files:**
- Create: `cost-share-app/supabase/config.toml`
- Create: `cost-share-app/supabase/functions/exchange-rates/index.ts`

- [ ] **Step 1: Create `config.toml`**

```toml
# Supabase local / deploy config (cost-share-app)

[functions.exchange-rates]
verify_jwt = true
```

- [ ] **Step 2: Create Edge Function**

```typescript
// supabase/functions/exchange-rates/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const OPEN_ER_API = 'https://open.er-api.com/v6/latest';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody = {
  base?: string;
  symbols?: string[];
};

type SnapshotRow = {
  base_code: string;
  rates: Record<string, number>;
  rate_date: string;
  fetched_at: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function ratesDateFromUnix(unix?: number): string {
  if (!unix) return new Date().toISOString().slice(0, 10);
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

function pickSymbols(
  table: Record<string, number>,
  base: string,
  symbols: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sym of symbols) {
    if (sym === base) continue;
    const rate = table[sym];
    if (!rate || rate <= 0 || !Number.isFinite(rate)) {
      throw new Error(`Missing exchange rate for ${sym}`);
    }
    out[sym] = rate;
  }
  return out;
}

async function fetchUpstream(base: string): Promise<{
  rateDate: string;
  rates: Record<string, number>;
}> {
  const res = await fetch(`${OPEN_ER_API}/${encodeURIComponent(base)}`);
  if (!res.ok) {
    throw new Error(`Upstream FX failed (${res.status})`);
  }
  const json = await res.json();
  const table = json.rates ?? json.conversion_rates;
  if (json.result !== 'success' || !table) {
    throw new Error('Upstream FX returned error');
  }
  return {
    rateDate: ratesDateFromUnix(json.time_last_update_unix),
    rates: table as Record<string, number>,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const base = (body.base ?? '').toUpperCase();
  const symbols = (body.symbols ?? []).map((s) => s.toUpperCase()).filter((s) => s && s !== base);
  if (!base || base.length !== 3) {
    return jsonResponse({ error: 'base must be a 3-letter currency code' }, 400);
  }
  if (symbols.length === 0) {
    return jsonResponse({ date: new Date().toISOString().slice(0, 10), rates: {} });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: cached, error: readErr } = await admin
    .from('fx_rate_snapshots')
    .select('base_code, rates, rate_date, fetched_at')
    .eq('base_code', base)
    .maybeSingle<SnapshotRow>();

  if (readErr) {
    console.error('fx cache read failed', readErr);
    return jsonResponse({ error: 'Cache read failed' }, 500);
  }

  const now = Date.now();
  const cacheFresh =
    cached && now - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS;

  let fullRates: Record<string, number>;
  let rateDate: string;

  if (cacheFresh && cached) {
    fullRates = cached.rates;
    rateDate = cached.rate_date;
  } else {
    try {
      const upstream = await fetchUpstream(base);
      fullRates = upstream.rates;
      rateDate = upstream.rateDate;
      const { error: upsertErr } = await admin.from('fx_rate_snapshots').upsert({
        base_code: base,
        rates: fullRates,
        rate_date: rateDate,
        fetched_at: new Date().toISOString(),
      });
      if (upsertErr) {
        console.error('fx cache upsert failed', upsertErr);
      }
    } catch (e) {
      if (cached) {
        fullRates = cached.rates;
        rateDate = cached.rate_date;
      } else {
        return jsonResponse({ error: (e as Error).message }, 502);
      }
    }
  }

  try {
    const rates = pickSymbols(fullRates, base, symbols);
    return jsonResponse({ date: rateDate, rates });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 502);
  }
});
```

- [ ] **Step 3: Deploy function**

Run:
```bash
cd cost-share-app
supabase functions deploy exchange-rates --no-verify-jwt=false
```
Expected: `Deployed Function exchange-rates`.

- [ ] **Step 4: Smoke test (replace PROJECT_REF and paste user JWT)**

```bash
curl -s -X POST "https://PROJECT_REF.supabase.co/functions/v1/exchange-rates" \
  -H "Authorization: Bearer USER_ACCESS_TOKEN" \
  -H "apikey: ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"base":"ILS","symbols":["USD"]}'
```
Expected: `{"date":"2026-05-20","rates":{"USD":0.27...}}` (approximate).

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/supabase/config.toml cost-share-app/supabase/functions/exchange-rates/index.ts
git commit -m "feat(supabase): add exchange-rates edge function with DB cache"
```

---

### Task 2: Point mobile service at Edge Function

**Files:**
- Modify: `cost-share-app/apps/mobile/services/exchangeRates.service.ts`
- Modify: `cost-share-app/apps/mobile/.env.example`

- [ ] **Step 1: Write failing test (invoke mock)**

Replace `cost-share-app/apps/mobile/__tests__/services/exchangeRates.service.test.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { fetchExchangeRates } from '../../services/exchangeRates.service';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockInvoke = supabase.functions.invoke as jest.Mock;

describe('fetchExchangeRates', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockInvoke.mockReset();
  });

  it('invokes exchange-rates edge function and caches result', async () => {
    mockInvoke.mockResolvedValue({
      data: { date: '2026-05-20', rates: { USD: 0.27 } },
      error: null,
    });

    const first = await fetchExchangeRates('ILS', ['USD']);
    expect(first).toEqual({ date: '2026-05-20', rates: { USD: 0.27 } });
    expect(mockInvoke).toHaveBeenCalledWith('exchange-rates', {
      body: { base: 'ILS', symbols: ['USD'] },
    });
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    const second = await fetchExchangeRates('ILS', ['USD']);
    expect(second).toEqual(first);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('throws when edge function returns error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Upstream FX failed' },
    });

    await expect(fetchExchangeRates('ILS', ['USD'])).rejects.toThrow(/Upstream FX failed/);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run:
```bash
cd cost-share-app/apps/mobile && npm test -- --testPathPattern=exchangeRates.service --no-cache
```
Expected: FAIL — still calls `fetch` directly or wrong invoke args.

- [ ] **Step 3: Replace `exchangeRates.service.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const CACHE_PREFIX = 'fx_rates_v3';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EDGE_FUNCTION = 'exchange-rates';

export type ExchangeRatesPayload = {
  date: string;
  rates: Record<string, number>;
};

type CachedEntry = ExchangeRatesPayload & { fetchedAt: number };

function cacheKey(base: string, symbols: string[]): string {
  return `${CACHE_PREFIX}:${base}:${[...symbols].sort((a, b) => a.localeCompare(b)).join(',')}`;
}

async function readCache(base: string, symbols: string[]): Promise<ExchangeRatesPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(base, symbols));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedEntry;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return { date: entry.date, rates: entry.rates };
  } catch {
    return null;
  }
}

async function writeCache(base: string, symbols: string[], payload: ExchangeRatesPayload): Promise<void> {
  const entry: CachedEntry = { ...payload, fetchedAt: Date.now() };
  await AsyncStorage.setItem(cacheKey(base, symbols), JSON.stringify(entry));
}

/**
 * Latest FX rates via Supabase Edge Function (shared DB cache server-side).
 * Rate semantics: units of `symbol` per 1 `base` (same as open.er-api / Frankfurter).
 */
export async function fetchExchangeRates(
  baseCurrency: string,
  symbols: string[],
): Promise<ExchangeRatesPayload> {
  const unique = [...new Set(symbols.filter((s) => s && s !== baseCurrency))];
  if (unique.length === 0) {
    return { date: new Date().toISOString().slice(0, 10), rates: {} };
  }

  const cached = await readCache(baseCurrency, unique);
  if (cached) return cached;

  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: { base: baseCurrency, symbols: unique },
  });

  if (error) {
    throw new Error(error.message ?? 'Exchange rate fetch failed');
  }

  const payload = data as ExchangeRatesPayload | null;
  if (!payload?.date || !payload.rates) {
    throw new Error('Exchange rate function returned invalid payload');
  }

  await writeCache(baseCurrency, unique, payload);
  return payload;
}
```

- [ ] **Step 4: Update `.env.example`**

Add after Supabase keys block:

```
# After first deploy:
#   supabase functions deploy exchange-rates
# Profile FX rollup calls this function (JWT required). DB cache: fx_rate_snapshots.
```

- [ ] **Step 5: Run tests — expect PASS**

Run:
```bash
cd cost-share-app/apps/mobile && npm test -- --testPathPattern="exchangeRates|fxConversion|BalanceHeroCard|ProfileScreen" --no-cache
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add cost-share-app/apps/mobile/services/exchangeRates.service.ts \
  cost-share-app/apps/mobile/__tests__/services/exchangeRates.service.test.ts \
  cost-share-app/apps/mobile/.env.example
git commit -m "feat(mobile): fetch profile FX rates via Supabase edge function"
```

---

### Task 3: Update SRS + manual verification

**Files:**
- Modify: `docs/SSOT/SRS.md`

- [ ] **Step 1: Update REQ-PROF-07 row**

Replace acceptance text with:

> Profile hero converts multi-currency balances to `defaultCurrency` using `exchange-rates` Edge Function; shared `fx_rate_snapshots` cache (24h); client AsyncStorage L2 cache; per-currency breakdown unchanged.

- [ ] **Step 2: Manual test checklist**

1. Sign in on Expo Web (`localhost:8081`) — open Profile.
2. DevTools → Network: confirm call to `.../functions/v1/exchange-rates` (not `open.er-api.com`).
3. Multi-currency user: hero shows converted total in `defaultCurrency`.
4. Second refresh within 24h: no new upstream call (check Supabase `fx_rate_snapshots.fetched_at` unchanged).
5. Change profile currency to ILS → save → hero recalculates in ₪.

- [ ] **Step 3: Commit**

```bash
git add docs/SSOT/SRS.md
git commit -m "docs: update REQ-PROF-07 for edge function FX cache"
```

---

## Self-review (completed)

| Check | Result |
|-------|--------|
| Spec: centralized 24h cache | Task 0 + Edge upsert |
| Spec: JWT / abuse protection | `verify_jwt = true` |
| Spec: API failure → breakdown only | Unchanged in `useProfileBalanceSummary` |
| No placeholders | All steps include concrete code/commands |
| Type names consistent | `ExchangeRatesPayload`, `exchange-rates` throughout |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-profile-fx-edge-function.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — implement tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
