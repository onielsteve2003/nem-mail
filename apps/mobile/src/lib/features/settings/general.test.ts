import { AI_FEATURES, DEFAULT_REPLIES, DENSITIES, SWIPE_ACTIONS, THEMES } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import {
	DENSITY_OPTIONS,
	REPLY_OPTIONS,
	SWIPE_OPTIONS,
	THEME_OPTIONS,
	swipeLabel
} from './general.js';
import { AI_FEATURE_COPY } from './ai.js';

const values = (options: { value: string }[]) => options.map((option) => option.value).sort();

describe('general settings options', () => {
	it('offer every value the settings schema allows', () => {
		expect(values(THEME_OPTIONS)).toEqual([...THEMES].sort());
		expect(values(DENSITY_OPTIONS)).toEqual([...DENSITIES].sort());
		expect(values(REPLY_OPTIONS)).toEqual([...DEFAULT_REPLIES].sort());
	});
});

describe('swipe options', () => {
	it('cover every swipe action with a label', () => {
		expect(values(SWIPE_OPTIONS)).toEqual([...SWIPE_ACTIONS].sort());
		expect(swipeLabel('toggleRead')).toBe('Mark read or unread');
	});
});

describe('AI settings copy', () => {
	it('names every AI feature exactly once', () => {
		expect(AI_FEATURE_COPY.map((copy) => copy.feature).sort()).toEqual([...AI_FEATURES].sort());
	});
});
