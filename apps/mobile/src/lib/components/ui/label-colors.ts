import type { LabelColor } from '@nem/shared';

/** The accent each label color shows as a dot or swatch; names always go with it. */
export const LABEL_DOT: Record<LabelColor, string> = {
	neutral: 'var(--nm-color-text-subtle)',
	violet: 'var(--nm-color-violet)',
	lime: 'var(--nm-color-lime)',
	cyan: 'var(--nm-color-cyan)',
	coral: 'var(--nm-color-coral)',
	amber: 'var(--nm-color-amber)'
};

/** Names for the colors, so a choice never relies on color alone. */
export const LABEL_COLOR_NAMES: Record<LabelColor, string> = {
	neutral: 'Gray',
	violet: 'Violet',
	lime: 'Lime',
	cyan: 'Cyan',
	coral: 'Coral',
	amber: 'Amber'
};
