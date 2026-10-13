import type { Settings, SwipeAction } from '@nem/shared';
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

/** Every swipe action, in the order the swipe settings list them. */
export const SWIPE_OPTIONS: Segment<SwipeAction>[] = [
	{ value: 'archive', label: 'Archive' },
	{ value: 'delete', label: 'Delete' },
	{ value: 'toggleRead', label: 'Mark read or unread' },
	{ value: 'snooze', label: 'Snooze' },
	{ value: 'move', label: 'Move to' },
	{ value: 'none', label: 'None' }
];

export function swipeLabel(action: SwipeAction): string {
	return SWIPE_OPTIONS.find((option) => option.value === action)?.label ?? action;
}
