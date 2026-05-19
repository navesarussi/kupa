import { I18nManager, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

/** True when UI should mirror for Hebrew — works even if I18nManager.forceRTL needs a restart. */
export function useRtlLayout(): boolean {
    const { i18n } = useTranslation();
    return I18nManager.isRTL || i18n.language === 'he';
}

export function rtlRowStyle(isRtl: boolean): ViewStyle {
    return {
        flexDirection: 'row',
        direction: isRtl ? 'rtl' : 'ltr',
    };
}

export function rtlTextAlign(isRtl: boolean): 'left' | 'right' {
    return isRtl ? 'right' : 'left';
}

export function rtlTrailingAlign(isRtl: boolean): 'flex-start' | 'flex-end' {
    return isRtl ? 'flex-start' : 'flex-end';
}
