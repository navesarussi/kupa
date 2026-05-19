import React from 'react';
import { render } from '@testing-library/react-native';
import { HighlightedText } from '../../components/HighlightedText';

describe('HighlightedText', () => {
    it('renders plain text when no query is provided', () => {
        const { getByText } = render(<HighlightedText text="Hello world" />);
        expect(getByText('Hello world')).toBeTruthy();
    });

    it('renders plain text when query is empty after trim', () => {
        const { getByText } = render(<HighlightedText text="Hello" query="   " />);
        expect(getByText('Hello')).toBeTruthy();
    });

    it('case-insensitively splits text around matches', () => {
        const { queryByText } = render(
            <HighlightedText text="aBcAbC" query="ab" />,
        );
        // matches are split out into nested Text elements; we can find them individually
        expect(queryByText('aB')).toBeTruthy();
        expect(queryByText('Ab')).toBeTruthy();
    });
});
