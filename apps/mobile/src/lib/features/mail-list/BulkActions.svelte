<script lang="ts">
	import Archive from '@lucide/svelte/icons/archive';
	import Bell from '@lucide/svelte/icons/bell';
	import BellOff from '@lucide/svelte/icons/bell-off';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import Clock from '@lucide/svelte/icons/clock';
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
	import FolderInput from '@lucide/svelte/icons/folder-input';
	import Mail from '@lucide/svelte/icons/mail';
	import MailOpen from '@lucide/svelte/icons/mail-open';
	import OctagonAlert from '@lucide/svelte/icons/octagon-alert';
	import Star from '@lucide/svelte/icons/star';
	import Tag from '@lucide/svelte/icons/tag';
	import Trash from '@lucide/svelte/icons/trash';
	import type { Label, ThreadOp, ThreadSummary } from '@nem/shared';
	import ActionSheet, { type ActionSheetItem } from '#components/ui/ActionSheet.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import { MOVE_TARGETS, bulkToggles, snoozePresets } from './bulk.js';

	const COPY = {
		archive: 'Archive',
		delete: 'Delete',
		markRead: 'Mark read',
		markUnread: 'Mark unread',
		more: 'More actions',
		star: 'Star',
		unstar: 'Remove star',
		markImportant: 'Mark important',
		markNotImportant: 'Mark not important',
		label: 'Add label…',
		move: 'Move to…',
		snooze: 'Snooze…',
		spam: 'Report spam',
		mute: 'Mute',
		unmute: 'Unmute',
		labelTitle: 'Add label',
		moveTitle: 'Move to',
		snoozeTitle: 'Snooze until'
	};

	interface Props {
		/** The selected threads. */
		threads: readonly ThreadSummary[];
		/** The account's labels, for "Add label". */
		labels: readonly Label[];
		/** Runs an op on the whole selection. */
		onapply: (op: ThreadOp) => void;
	}

	let { threads, labels, onapply }: Props = $props();

	// The pickers are quick versions; M8 brings the full label, move and snooze sheets.
	let sheet = $state<'more' | 'labels' | 'move' | 'snooze' | null>(null);

	const toggles = $derived(bulkToggles(threads));
	const isEmpty = $derived(threads.length === 0);

	// Read state sits here, not in the bar, so the bar fits a 360px phone.
	const more = $derived<ActionSheetItem[]>([
		{
			label: COPY[toggles.read.op],
			icon: toggles.read.op === 'markRead' ? MailOpen : Mail,
			onselect: () => onapply(toggles.read)
		},
		{
			label: COPY[toggles.star.op],
			icon: Star,
			onselect: () => onapply(toggles.star)
		},
		{
			label: COPY[toggles.important.op],
			icon: Bookmark,
			onselect: () => onapply(toggles.important)
		},
		{
			label: COPY.label,
			icon: Tag,
			disabled: labels.length === 0,
			onselect: () => (sheet = 'labels')
		},
		{ label: COPY.move, icon: FolderInput, onselect: () => (sheet = 'move') },
		{ label: COPY.snooze, icon: Clock, onselect: () => (sheet = 'snooze') },
		{
			label: COPY.spam,
			icon: OctagonAlert,
			destructive: true,
			onselect: () => onapply({ op: 'spam' })
		},
		{
			label: COPY[toggles.mute.op],
			icon: toggles.mute.op === 'mute' ? BellOff : Bell,
			onselect: () => onapply(toggles.mute)
		}
	]);
	const labelItems = $derived<ActionSheetItem[]>(
		labels.map((label) => ({
			label: label.name,
			icon: Tag,
			onselect: () => onapply({ op: 'addLabels', labelIds: [label.id] })
		}))
	);
	const moveItems: ActionSheetItem[] = MOVE_TARGETS.map(({ to, label }) => ({
		label,
		onselect: () => onapply({ op: 'move', to })
	}));
	// Computed when the sheet opens, so "later today" is from now.
	const snoozeItems = $derived<ActionSheetItem[]>(
		sheet === 'snooze'
			? snoozePresets(new Date()).map(({ label, until }) => ({
					label,
					icon: Clock,
					onselect: () => onapply({ op: 'snooze', until: until.toISOString() })
				}))
			: []
	);

	const close = () => (sheet = null);
</script>

<IconButton
	icon={Archive}
	label={COPY.archive}
	disabled={isEmpty}
	onclick={() => onapply({ op: 'archive' })}
/>
<IconButton
	icon={Trash}
	label={COPY.delete}
	disabled={isEmpty}
	onclick={() => onapply({ op: 'trash' })}
/>
<IconButton
	icon={EllipsisVertical}
	label={COPY.more}
	disabled={isEmpty}
	aria-haspopup="dialog"
	onclick={() => (sheet = 'more')}
/>

<ActionSheet open={sheet === 'more'} title={COPY.more} hideTitle actions={more} onclose={close} />
<ActionSheet
	open={sheet === 'labels'}
	title={COPY.labelTitle}
	actions={labelItems}
	onclose={close}
/>
<ActionSheet open={sheet === 'move'} title={COPY.moveTitle} actions={moveItems} onclose={close} />
<ActionSheet
	open={sheet === 'snooze'}
	title={COPY.snoozeTitle}
	actions={snoozeItems}
	onclose={close}
/>
