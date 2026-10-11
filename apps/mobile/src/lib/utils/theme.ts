export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_PREFERENCES = ['system', ...THEMES] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/**
 * localStorage key for the theme preference. The no-flash script in app.html
 * reads the same key before the app boots, so keep them in sync.
 */
export const THEME_STORAGE_KEY = 'nm-theme';

export const PREFERS_LIGHT_QUERY = '(prefers-color-scheme: light)';

/** Turns a stored value into a preference, falling back to `system` for anything unknown. */
export function parseThemePreference(value: string | null | undefined): ThemePreference {
	return (THEME_PREFERENCES as readonly string[]).includes(value ?? '')
		? (value as ThemePreference)
		: 'system';
}

/** The theme to paint: an explicit choice wins, `system` follows the OS setting. */
export function resolveTheme(preference: ThemePreference, systemPrefersLight: boolean): Theme {
	if (preference !== 'system') return preference;
	return systemPrefersLight ? 'light' : 'dark';
}
