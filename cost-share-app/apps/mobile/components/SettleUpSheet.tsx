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
import { View, Pressable, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { GroupMemberLite, PairwiseDebt, PaymentMethod } from '@cost-share/shared';
import { Text } from './AppText';
import { Button } from './Button';
import { MemberAvatar } from './MemberAvatar';
import { AppIcon } from './AppIcon';
import type { AppIconName } from './AppIcon';
import { BottomSheetShell } from './BottomSheetShell';
import { DatePickerPopup } from './expenseV2/DatePickerPopup';
import {
    CurrencyPickerPopup,
    type CurrencyPickerOption,
} from './expenseV2/CurrencyPickerPopup';
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

const METHOD_TILES: ReadonlyArray<{ key: MethodKey; icon: AppIconName }> = [
    { key: 'cash', icon: 'cash-outline' },
    { key: 'bank_transfer', icon: 'card-outline' },
    { key: 'paypal', icon: 'logo-paypal' },
    { key: 'other', icon: 'ellipsis-horizontal' },
];

const formatAmountText = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '');
const formatShortDate = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function SettleUpSheet({
    visible,
    members,
    pairwiseDebts,
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

    const fromUserId = initial.fromUserId;
    const toUserId = initial.toUserId;
    const [currency, setCurrency] = useState(initial.currency);
    const [amountText, setAmountText] = useState(formatAmountText(initial.amount));
    const [paymentMethod, setPaymentMethod] = useState<MethodKey>(
        (initial.paymentMethod as MethodKey | undefined) ?? 'bank_transfer'
    );
    const [settlementDate, setSettlementDate] = useState<Date>(
        initial.settlementDate ?? new Date()
    );
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setCurrency(initial.currency);
        setAmountText(formatAmountText(initial.amount));
        setPaymentMethod((initial.paymentMethod as MethodKey | undefined) ?? 'bank_transfer');
        setSettlementDate(initial.settlementDate ?? new Date());
    }, [
        visible,
        initial.currency,
        initial.amount,
        initial.paymentMethod,
        initial.settlementDate,
    ]);

    const owedCurrencyOptions = useMemo<CurrencyPickerOption[]>(() => {
        const filtered = pairwiseDebts
            .filter(
                d =>
                    d.fromUserId === initial.fromUserId &&
                    d.toUserId === initial.toUserId &&
                    d.amount > 0,
            )
            .map(d => ({ currency: d.currency, amount: d.amount }));
        if (filtered.some(o => o.currency === initial.currency)) return filtered;
        return [
            { currency: initial.currency, amount: initial.amount },
            ...filtered,
        ];
    }, [pairwiseDebts, initial.fromUserId, initial.toUserId, initial.currency, initial.amount]);

    const canPickCurrency = mode === 'create' && owedCurrencyOptions.length > 1;

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

    const handleCurrencySelected = useCallback(
        (option: CurrencyPickerOption) => {
            setCurrency(option.currency);
            setAmountText(formatAmountText(option.amount));
            setCurrencyPickerOpen(false);
        },
        [],
    );

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
                    canPickCurrency={canPickCurrency}
                    onOpenCurrencyPicker={() => setCurrencyPickerOpen(true)}
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
                    saveLabel={t('common.save')}
                    submitting={submitting}
                />

                <DatePickerPopup
                    visible={datePickerOpen}
                    initialDate={settlementDate}
                    onCancel={() => setDatePickerOpen(false)}
                    onConfirm={next => {
                        setSettlementDate(next);
                        setDatePickerOpen(false);
                    }}
                />

                <CurrencyPickerPopup
                    visible={currencyPickerOpen}
                    options={owedCurrencyOptions}
                    selectedCurrency={currency}
                    onCancel={() => setCurrencyPickerOpen(false)}
                    onConfirm={handleCurrencySelected}
                />

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
    canPickCurrency: boolean;
    onOpenCurrencyPicker: () => void;
    groupName?: string;
    isRtl: boolean;
}

function SettleUpHero({
    fromMember,
    toMember,
    currency,
    amountText,
    onAmountChange,
    canPickCurrency,
    onOpenCurrencyPicker,
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
                        <View
                            className="flex-row items-baseline rounded-xl px-3 py-1"
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.14)',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.32)',
                            }}
                        >
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
                                    minWidth: 80,
                                    padding: 0,
                                    textAlign: 'center',
                                }}
                                testID="settle-amount-input"
                            />
                        </View>

                        <CurrencyChip
                            currency={currency}
                            canPick={canPickCurrency}
                            onPress={onOpenCurrencyPicker}
                            label={t('settleUp.currency')}
                        />

                        <View className="flex-row items-center mt-2 w-3/4">
                            <View className="flex-1 h-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }} />
                            <AppIcon
                                name={isRtl ? 'chevron-back' : 'chevron-forward'}
                                size={18}
                                color="rgba(255,255,255,0.95)"
                            />
                            <View className="flex-1 h-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }} />
                        </View>
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

/* ----- Currency chip ------------------------------------------------------- */

interface CurrencyChipProps {
    currency: string;
    canPick: boolean;
    onPress: () => void;
    label: string;
}

function CurrencyChip({ currency, canPick, onPress, label }: CurrencyChipProps) {
    const chipStyle = {
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
    } as const;

    if (!canPick) {
        return (
            <View
                testID="settle-currency-chip-static"
                className="flex-row items-center mt-2 rounded-full px-2 py-0.5"
                style={chipStyle}
            >
                <Text className="text-white text-[10px] font-bold">{currency}</Text>
            </View>
        );
    }

    return (
        <Pressable
            onPress={onPress}
            testID="settle-currency-chip"
            className="flex-row items-center mt-2 rounded-full px-2 py-0.5"
            style={chipStyle}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Text className="text-white text-[10px] font-bold mr-1">{currency}</Text>
            <AppIcon name="chevron-down" size={10} color="#FFFFFF" />
        </Pressable>
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
                            name={icon}
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
    saveLabel: string;
    submitting: boolean;
}

function SettleUpBottomDock({
    settlementDate,
    onOpenDatePicker,
    onRecord,
    recordDisabled,
    saveLabel,
    submitting,
}: SettleUpBottomDockProps) {
    return (
        <View
            className="absolute left-0 right-0 bottom-0 bg-white/95 border-t border-border-soft"
            style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22 }}
        >
            <View className="items-center mb-3">
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
                    accessibilityLabel={formatShortDate(settlementDate)}
                    testID="settle-date-chip"
                >
                    <AppIcon name="calendar-outline" size={13} color="#4B5563" />
                    <Text className="text-[12px] font-semibold text-gray-500 mx-1.5">
                        {formatShortDate(settlementDate)}
                    </Text>
                    <AppIcon name="chevron-down" size={11} color="#6B7280" />
                </Pressable>
            </View>

            <View
                className="items-center"
                style={recordDisabled ? { opacity: 0.55 } : null}
            >
                <Button
                    title={saveLabel}
                    onPress={onRecord}
                    variant="secondary"
                    loading={submitting}
                    disabled={recordDisabled}
                    fullWidth={false}
                    testID="settle-record-button"
                />
            </View>
        </View>
    );
}
