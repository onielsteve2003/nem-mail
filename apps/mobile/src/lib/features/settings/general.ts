import type { Settings } from '@nem/shared';
import type { Segment } from '#components/ui/SegmentedControl.svelte';

export const THEME_OPTIONS: Segment<Settings['theme']>[] = [
	{ value: 'dark', label: 'Dark' },
	{ value: 'light', label: 'Light' },
	{ value: 'system', label: 'System' }
];

export const DENSITY_OPTIONS: Segment<Settings['density']>[] = [
	{ value: 'compact', label: 'Compact' },
	{ value: 'default', label: 'Default' },
	{ value: 'comfortable', label: 'Comfortable' }
];

export const REPLY_OPTIONS: Segment<Settings['defaultReply']>[] = [
	{ value: 'reply', label: 'Reply' },
	{ value: 'replyAll', label: 'Reply all' }
];
