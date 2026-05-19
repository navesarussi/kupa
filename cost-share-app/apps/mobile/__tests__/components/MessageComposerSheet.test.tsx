import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MessageComposerSheet } from '../../components/MessageComposerSheet';

describe('MessageComposerSheet', () => {
    it('disables send until the body has non-whitespace text', () => {
        const onSubmit = jest.fn();
        const { getByTestId } = render(
            <MessageComposerSheet
                visible
                mode="create"
                onSubmit={onSubmit}
                onClose={() => {}}
            />,
        );
        fireEvent.press(getByTestId('composer-send'));
        expect(onSubmit).not.toHaveBeenCalled();

        fireEvent.changeText(getByTestId('composer-input'), 'hi');
        fireEvent.press(getByTestId('composer-send'));
        expect(onSubmit).toHaveBeenCalledWith('hi');
    });

    it('prefills with initialBody in edit mode', async () => {
        const { getByTestId } = render(
            <MessageComposerSheet
                visible
                mode="edit"
                initialBody="old text"
                onSubmit={async () => {}}
                onClose={() => {}}
            />,
        );
        await waitFor(() => {
            expect(getByTestId('composer-input').props.value).toBe('old text');
        });
    });
});
