import { describe, expect, it } from 'vitest';
import { errorPageCopy } from './errors.js';

describe('errorPageCopy', () => {
	it('has its own copy for 404 and a generic one otherwise', () => {
		expect(errorPageCopy(404).title).toBe('Page not found');
		expect(errorPageCopy(500).title).toBe('Something went wrong');
		expect(errorPageCopy(403).title).toBe('Something went wrong');
	});
});
