import { describe, expect, it } from 'vitest';
import { swipeTarget, threadNeighbors, threadShortcut } from './thread-nav.js';

describe('threadNeighbors', () => {
	it('finds the newer and older threads, null at the ends or when missing', () => {
		expect(threadNeighbors(['a', 'b', 'c'], 'b')).toEqual({ newer: 'a', older: 'c' });
		expect(threadNeighbors(['a', 'b'], 'a')).toEqual({ newer: null, older: 'b' });
		expect(threadNeighbors(['a'], 'x')).toEqual({ newer: null, older: null });
	});
});

describe('swipeTarget', () => {
	it('maps long sideways moves and ignores short or vertical ones', () => {
		expect(swipeTarget(-120, 10)).toBe('older');
		expect(swipeTarget(120, -10)).toBe('newer');
		expect(swipeTarget(-40, 0)).toBeNull();
		expect(swipeTarget(-120, 90)).toBeNull();
	});
});

describe('threadShortcut', () => {
	const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
		threadShortcut({
			key: k,
			ctrlKey: false,
			altKey: false,
			metaKey: false,
			target: null,
			...extra
		});

	it('maps Gmail keys', () => {
		expect(key('j')).toBe('older');
		expect(key('k')).toBe('newer');
		expect(key('e')).toBe('archive');
		expect(key('#')).toBe('trash');
		expect(key('r')).toBe('reply');
		expect(key('x')).toBeNull();
	});

	it('ignores modifiers and typing', () => {
		expect(key('r', { ctrlKey: true })).toBeNull();
		const input = document.createElement('input');
		expect(key('j', { target: input })).toBeNull();
	});
});
