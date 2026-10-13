import { DEFAULT_REPLIES, DENSITIES, THEMES } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { DENSITY_OPTIONS, REPLY_OPTIONS, THEME_OPTIONS } from './general.js';

const values = (options: { value: string }[]) => options.map((option) => option.value).sort();

describe('general settings options', () => {
	it('offer every value the settings schema allows', () => {
		expect(values(THEME_OPTIONS)).toEqual([...THEMES].sort());
		expect(values(DENSITY_OPTIONS)).toEqual([...DENSITIES].sort());
		expect(values(REPLY_OPTIONS)).toEqual([...DEFAULT_REPLIES].sort());
	});
});
