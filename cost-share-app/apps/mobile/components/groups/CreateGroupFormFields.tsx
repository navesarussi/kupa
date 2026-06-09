/**
 * Shared fields for create / edit group (used by CreateGroupScreen and onboarding).
 */

import React, { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { platformAlert } from '../../lib/platformAlert';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { GroupType, User } from '@cost-share/shared';
import { Input } from '../Input';
import { GroupTypeSelector } from '../GroupTypeSelector';
import { CurrencyPicker } from '../CurrencyPicker';
import { Text } from '../AppText';
import { CreateGroupCoverPreview } from './CreateGroupCoverPreview';
import { GroupFormSection } from './CreateGroupFormShell';
import { GroupMembersField } from './GroupMembersField';

export type CreateGroupFormFieldsProps = {
    isEdit: boolean;
    name: string;
    nameError?: string;
    onNameChange: (text: string) => void;
    groupType: GroupType;
    onGroupTypeChange: (type: GroupType) => void;
    currency: string;
    onCurrencyChange: (code: string) => void;
    imageUrl?: string | null;
    localImageUri?: string | null;
    onImageChange: (uri: string | null) => void;
    displayMembers: User[];
    currentUserId: string | null;
    currentUser: User | null | undefined;
    onAddMembers: () => void;
    onRemoveMember: (member: User) => void;
    membersHintKey?: string;
    /** Rendered above the group name field (onboarding suggestions, etc.). */
    nameAccessory?: React.ReactNode;
};

export function CreateGroupFormFields({
    isEdit,
    name,
    nameError,
    onNameChange,
    groupType,
    onGroupTypeChange,
    currency,
    onCurrencyChange,
    imageUrl,
    localImageUri,
    onImageChange,
    displayMembers,
    currentUserId,
    currentUser,
    onAddMembers,
    onRemoveMember,
    membersHintKey = 'groups.createForm.membersHint',
    nameAccessory,
}: CreateGroupFormFieldsProps) {
    const { t } = useTranslation();

    const pickImage = useCallback(async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            platformAlert(t('groups.imagePermissionTitle'), t('groups.imagePermissionMessage'));
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.85,
        });
        if (!result.canceled && result.assets[0]?.uri) {
            onImageChange(result.assets[0].uri);
        }
    }, [onImageChange, t]);

    const displayUri = localImageUri ?? imageUrl ?? null;

    return (
        <>
            <CreateGroupCoverPreview
                name={name}
                groupType={groupType}
                imageUrl={imageUrl}
                localUri={localImageUri}
                onPress={() => void pickImage()}
                testID="group-form-cover"
            />

            {displayUri ? (
                <TouchableOpacity
                    onPress={() => onImageChange(null)}
                    className="mb-4 self-start"
                    testID="group-form-cover-remove"
                >
                    <Text className="text-sm font-medium text-red-500">
                        {t('groups.removeImage')}
                    </Text>
                </TouchableOpacity>
            ) : null}

            <GroupFormSection title={t('groups.createForm.sectionIdentity')}>
                {nameAccessory}
                <Input
                    label={t('groups.groupName')}
                    placeholder={t('groups.createForm.namePlaceholder')}
                    value={name}
                    onChangeText={onNameChange}
                    error={nameError}
                    containerClassName="mb-0"
                />
            </GroupFormSection>

            <GroupTypeSelector value={groupType} onChange={onGroupTypeChange} />

            <GroupFormSection title={t('groups.createForm.sectionSettings')}>
                <CurrencyPicker
                    value={currency}
                    onChange={onCurrencyChange}
                    label={t('groups.currency')}
                />
            </GroupFormSection>

            <GroupFormSection
                title={t('groups.members.title')}
                testID="group-form-members-section"
            >
                <Text className="text-sm text-gray-500 mb-3 leading-relaxed">
                    {t(membersHintKey)}
                </Text>
                <GroupMembersField
                    displayMembers={displayMembers}
                    currentUserId={currentUserId}
                    currentUser={currentUser}
                    onAddMembers={onAddMembers}
                    onRemoveMember={onRemoveMember}
                />
            </GroupFormSection>
        </>
    );
}
