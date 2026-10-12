import { describe, expect, it } from 'vitest';
import { ScrollMemory, backAction, navDirection } from './navigation.js';

const idle = { hasSheet: false, isDrawerOpen: false, isSelecting: false, isHome: false };

describe('navDirection', () => {
	it('slides back only for history back', () => {
		expect(navDirection({ type: 'popstate', delta: -1 })).toBe('back');
		expect(navDirection({ type: 'popstate', delta: 1 })).toBe('forward');
		expect(navDirection({ type: 'link' })).toBe('forward');
		expect(navDirection({ type: 'goto' })).toBe('forward');
	});
});

describe('backAction', () => {
	it('closes the most local thing first', () => {
		expect(
			backAction({ hasSheet: true, isDrawerOpen: true, isSelecting: true, isHome: true })
		).toBe('close-sheet');
		expect(backAction({ ...idle, isDrawerOpen: true, isSelecting: true })).toBe('close-drawer');
		expect(backAction({ ...idle, isSelecting: true, isHome: true })).toBe('clear-selection');
	});

	it('goes back a page, or leaves the app from home', () => {
		expect(backAction(idle)).toBe('navigate-back');
		expect(backAction({ ...idle, isHome: true })).toBe('exit');
	});
});

describe('ScrollMemory', () => {
	it('keeps one position per key', () => {
		const memory = new ScrollMemory();
		memory.save('/mail/inbox', 420);
		memory.save('/mail/sent', 80);
		expect(memory.get('/mail/inbox')).toBe(420);
		expect(memory.get('/mail/starred')).toBe(0);
		memory.clear();
		expect(memory.get('/mail/sent')).toBe(0);
	});
});
