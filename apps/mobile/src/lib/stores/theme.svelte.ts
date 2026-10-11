import { createContext } from 'svelte';
import {
	PREFERS_LIGHT_QUERY,
	THEME_STORAGE_KEY,
	parseThemePreference,
	resolveTheme,
	type Theme,
	type ThemePreference
} from '#lib/utils/theme.js';

/** Browser APIs the store touches, injectable so tests can fake them. */
export interface ThemeEnvironment {
	storage: Pick<Storage, 'getItem' | 'setItem'> | null;
	media: MediaQueryList | null;
	root: HTMLElement;
}

function browserEnvironment(): ThemeEnvironment {
	let storage: Storage | null = null;
	try {
		storage = window.localStorage;
	} catch {
		// Storage can throw when blocked (e.g. some private modes); the theme still works per session.
	}
	return {
		storage,
		media: typeof window.matchMedia === 'function' ? window.matchMedia(PREFERS_LIGHT_QUERY) : null,
		root: document.documentElement
	};
}

/**
 * Owns the theme preference (system, dark or light) and paints the resolved
 * theme onto `<html data-theme>` and the browser's theme-color.
 */
export class ThemeStore {
	preference = $state<ThemePreference>('system');
	systemPrefersLight = $state(false);
	readonly resolved: Theme = $derived(resolveTheme(this.preference, this.systemPrefersLight));

	#env: ThemeEnvironment;

	constructor(env: ThemeEnvironment = browserEnvironment()) {
		this.#env = env;
		this.preference = parseThemePreference(this.#read());
		this.systemPrefersLight = env.media?.matches ?? false;
	}

	setPreference(preference: ThemePreference): void {
		this.preference = preference;
		try {
			this.#env.storage?.setItem(THEME_STORAGE_KEY, preference);
		} catch {
			// Quota or privacy errors: keep the in-memory choice.
		}
	}

	/** Follows OS light/dark changes while `system` is chosen. Returns a cleanup function. */
	watchSystem(): () => void {
		const media = this.#env.media;
		if (!media) return () => {};
		const onChange = (event: MediaQueryListEvent) => {
			this.systemPrefersLight = event.matches;
		};
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}

	/** Writes the resolved theme to the DOM. Call it from an `$effect` so it re-runs on change. */
	apply(): void {
		const { root } = this.#env;
		root.dataset.theme = this.resolved;
		// Read the painted background back from the tokens so the color lives in one place.
		const background = getComputedStyle(root).getPropertyValue('--nm-color-bg').trim();
		const meta = root.ownerDocument.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
		if (meta && background) meta.content = background;
	}

	#read(): string | null {
		try {
			return this.#env.storage?.getItem(THEME_STORAGE_KEY) ?? null;
		} catch {
			return null;
		}
	}
}

export const [getThemeStore, setThemeStore] = createContext<ThemeStore>();
