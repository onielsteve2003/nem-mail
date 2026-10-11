import { flushSync } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '#lib/utils/theme.js';
import { ThemeStore, type ThemeEnvironment } from './theme.svelte.js';

/** A matchMedia result whose `matches` the test can flip, firing change listeners. */
function fakeMedia(initial: boolean) {
	const listeners = new Set<(event: MediaQueryListEvent) => void>();
	const media = {
		matches: initial,
		addEventListener: (_type: string, fn: (event: MediaQueryListEvent) => void) =>
			listeners.add(fn),
		removeEventListener: (_type: string, fn: (event: MediaQueryListEvent) => void) =>
			listeners.delete(fn)
	};
	return {
		media: media as unknown as MediaQueryList,
		listeners,
		set(matches: boolean) {
			media.matches = matches;
			for (const fn of listeners) fn({ matches } as MediaQueryListEvent);
		}
	};
}

function setup({ stored = null as string | null, systemLight = false } = {}) {
	const values = new Map<string, string>(stored ? [[THEME_STORAGE_KEY, stored]] : []);
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => void values.set(key, value)
	};
	const system = fakeMedia(systemLight);
	const env: ThemeEnvironment = { storage, media: system.media, root: document.documentElement };
	return { store: new ThemeStore(env), values, system };
}

afterEach(() => {
	delete document.documentElement.dataset.theme;
	document.head.innerHTML = '';
});

describe('ThemeStore', () => {
	it('starts from the saved preference', () => {
		expect(setup({ stored: 'light' }).store.resolved).toBe('light');
	});

	it('defaults to system and follows the OS when nothing valid is saved', () => {
		const { store } = setup({ stored: 'neon', systemLight: true });
		expect(store.preference).toBe('system');
		expect(store.resolved).toBe('light');
	});

	it('saves a new preference and resolves to it', () => {
		const { store, values } = setup({ systemLight: true });
		store.setPreference('dark');
		expect(store.resolved).toBe('dark');
		expect(values.get(THEME_STORAGE_KEY)).toBe('dark');
	});

	it('tracks OS changes while watching and stops after cleanup', () => {
		const { store, system } = setup();
		const stop = store.watchSystem();

		system.set(true);
		expect(store.resolved).toBe('light');

		stop();
		expect(system.listeners.size).toBe(0);
		system.set(false);
		expect(store.resolved).toBe('light');
	});

	it('writes the resolved theme to <html data-theme>', () => {
		const { store } = setup({ stored: 'light' });
		store.apply();
		expect(document.documentElement.dataset.theme).toBe('light');

		store.setPreference('dark');
		flushSync();
		store.apply();
		expect(document.documentElement.dataset.theme).toBe('dark');
	});

	it('keeps working when storage throws', () => {
		const env: ThemeEnvironment = {
			storage: {
				getItem: () => {
					throw new Error('blocked');
				},
				setItem: () => {
					throw new Error('blocked');
				}
			},
			media: null,
			root: document.documentElement
		};
		const store = new ThemeStore(env);
		expect(store.resolved).toBe('dark');
		store.setPreference('light');
		expect(store.resolved).toBe('light');
	});
});
