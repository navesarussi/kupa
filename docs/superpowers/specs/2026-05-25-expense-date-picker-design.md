# Expense Date Picker — Design

**Date:** 2026-05-25
**Scope:** `apps/mobile` — new/edit expense screen

## Background

The v2 New/Edit Expense screen (`apps/mobile/screens/expenses/AddExpenseScreen.tsx`,
also re-exported as `EditExpenseScreen`) shows a date pill in the meta row
(`AddExpenseScreen.tsx:537-545`). Today that pill's `onPress` is a no-op with the
comment "Date picker is out of scope per v2 spec — date defaults to today." The
underlying `date` state, the dynamic `dateLabel`, and the `expenseDate: date`
field on `createExpense` / `updateExpense` are already in place — only the
picker UI is missing.

## Goal

Tapping the date pill opens a calendar popup so the user can pick any date
(past or future) for the expense. Selection persists into the form's existing
`date` state and is written through unchanged on save.

## Non-goals

- Time-of-day selection (date only).
- Range selection.
- Locale-specific calendar systems (Gregorian only — matches the rest of the app).
- Min/max date constraints (intentionally unrestricted per product decision).

## Approach

### Library

Add **`react-native-calendars`** as a dependency in `apps/mobile/package.json`.

Rationale: it's a pure-JS library (no native modules), so it works in Expo
Go and EAS dev/production builds with no `prebuild` step. The product
decision is a custom-styled calendar grid (not the OS native picker), and
`react-native-calendars` is the established choice for this in the
React Native ecosystem.

Use the latest version compatible with `react-native@0.81.5` /
`react@19.1.0` (Expo SDK 54).

### New component

`apps/mobile/components/expenseV2/DatePickerPopup.tsx`

**Props:**

```ts
type DatePickerPopupProps = {
  visible: boolean;
  initialDate: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
};
```

**Behavior:**

- Wraps content in a React Native `Modal` with `transparent={true}`,
  `animationType="fade"`, `onRequestClose={onCancel}`.
- Full-screen `Pressable` backdrop with `rgba(0,0,0,0.4)` background — tap
  outside the card invokes `onCancel`.
- Centered white card (~340px wide, rounded corners, drop shadow consistent
  with other v2 sheets). Card swallows touches so backdrop taps inside the
  card don't dismiss.
- Header row inside the card:
  - **Cancel** (left, secondary text style) → `onCancel`
  - Title (center) → `t('expenses.v2.datePickerTitle')` ("Pick date")
  - **Done** (right, primary/bold style) → `onConfirm(new Date(draft))`
- Calendar grid: `<Calendar>` from `react-native-calendars`
  - `current={draft}` — the focused month
  - `markedDates={{ [draft]: { selected: true, selectedColor: colors.primaryDark } }}`
  - `onDayPress={day => setDraft(day.dateString)}` — updates draft only
  - `theme`: align `selectedDayBackgroundColor`, `todayTextColor`, and
    `arrowColor` with the existing `colors` palette
- Internal state: `const [draft, setDraft] = useState<string>(toIsoDate(initialDate))`
  where `toIsoDate` returns `yyyy-mm-dd` in the user's local timezone.
- `useEffect` resets `draft` to `toIsoDate(initialDate)` whenever
  `visible` flips from false to true — so reopening the popup starts from
  the current form value, not a stale earlier draft.

### Date string ↔ Date conversion

`react-native-calendars` uses `yyyy-mm-dd` strings. The form holds a
`Date`. Use local-timezone conversion in both directions:

- `toIsoDate(date: Date): string` — pads year/month/day from local
  components (do **not** use `date.toISOString()` because that's UTC and can
  shift the day for users in negative offsets).
- `fromIsoDate(iso: string): Date` — `new Date(year, month - 1, day)`.

These helpers live next to the component (small, co-located) — not a
shared util.

### Wiring in `AddExpenseScreen.tsx`

1. New state: `const [datePickerVisible, setDatePickerVisible] = useState(false);`
2. Replace the no-op at `AddExpenseScreen.tsx:541`:
   ```tsx
   onPress={() => setDatePickerVisible(true)}
   ```
3. Render the popup at the bottom of the screen, alongside the other
   modals (`EditPayerSplitSheet`, `CurrencyPicker`, `ConfirmDialog`):
   ```tsx
   <DatePickerPopup
     visible={datePickerVisible}
     initialDate={date}
     onCancel={() => setDatePickerVisible(false)}
     onConfirm={next => {
       setDate(next);
       setDatePickerVisible(false);
     }}
   />
   ```

No other changes to `AddExpenseScreen`. The existing `dateLabel` (today →
"Today", else `formatShortDate`) and the `expenseDate: date` passed to
`createExpense`/`updateExpense` already do the right thing.

### i18n

- `common.cancel` and `common.done` — already exist in `en.json` and
  `he.json`. Reuse.
- Add `expenses.v2.datePickerTitle` to both locale files:
  - en: "Pick date"
  - he: "בחר תאריך"
- Register Hebrew month/day names with `react-native-calendars`
  `LocaleConfig` at module load (top of `DatePickerPopup.tsx`):
  ```ts
  LocaleConfig.locales['he'] = {
    monthNames: [/* ינואר ... דצמבר */],
    monthNamesShort: [/* ינו׳ ... דצמ׳ */],
    dayNames: [/* ראשון ... שבת */],
    dayNamesShort: [/* א ... ש */],
  };
  ```
- Set `LocaleConfig.defaultLocale = i18n.language` and re-set it when
  the language changes (`useEffect` in the component, depending on
  `useAppLanguage()`).

### RTL

The centered modal layout is left/right symmetric, so it works the same
in RTL. The calendar grid stays LTR by design (matches Apple Calendar in
Hebrew, expected by Hebrew speakers). No layout flip needed.

### Date range

No `minDate` or `maxDate` — fully unrestricted past and future.

### Styling

Match the existing v2 visual language:
- Card background: white, border radius 16, shadow consistent with
  `EditPayerSplitSheet`.
- Title font: matches `headerTitle` in `AddExpenseScreen` styles.
- Cancel: `colors.gray600`, weight 500.
- Done: `colors.primaryDark`, weight 700.
- Calendar theme uses `colors.primaryDark` for the selected day and
  `colors.primaryLight`/`colors.primaryDark` for today's marker.

## Testing

### New: `apps/mobile/__tests__/components/expenseV2/DatePickerPopup.test.tsx`

- Renders nothing when `visible=false`.
- When `visible=true`, the title, Cancel, and Done are rendered.
- Tapping a day, then Done, calls `onConfirm` with a `Date` whose local
  year/month/day match the tapped day.
- Tapping Cancel calls `onCancel` and does not call `onConfirm`.
- Reopening with a different `initialDate` resets the highlighted day to
  the new initial.

### Update: `apps/mobile/__tests__/screens/expenses/AddExpenseScreen.test.tsx` and `EditExpenseScreen.test.tsx`

- Tapping `testID="meta-date"` opens the popup (assert by querying for
  the title or Done button).
- Picking a date and tapping Done updates the date pill's label.
- On Save, `createExpense` / `updateExpense` is called with
  `expenseDate` equal to the chosen `Date`.

## Files touched

- **Add:** `apps/mobile/components/expenseV2/DatePickerPopup.tsx`
- **Add:** `apps/mobile/__tests__/components/expenseV2/DatePickerPopup.test.tsx`
- **Edit:** `apps/mobile/screens/expenses/AddExpenseScreen.tsx`
  (one new state line, replace one `onPress`, render one new component)
- **Edit:** `apps/mobile/i18n/locales/en.json` (one new key)
- **Edit:** `apps/mobile/i18n/locales/he.json` (one new key)
- **Edit:** `apps/mobile/package.json` (one new dependency)
- **Edit:** `apps/mobile/__tests__/screens/expenses/AddExpenseScreen.test.tsx`
- **Edit:** `apps/mobile/__tests__/screens/expenses/EditExpenseScreen.test.tsx`

## Risks / open questions

- **`react-native-calendars` peer-dependency versions:** verify the
  installed version supports React 19 / RN 0.81 cleanly. If it warns,
  pin to the latest minor that is known compatible.
- **Hebrew month-name strings:** confirm with a Hebrew speaker after
  first render; the strings above are standard but worth a visual check.
