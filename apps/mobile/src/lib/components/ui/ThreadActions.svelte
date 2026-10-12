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
	import ActionSheet, { type ActionSheetItem } from './ActionSheet.svelte';
	import IconButton from './IconButton.svelte';
	import LabelPicker from './LabelPicker.svelte';
	import MoveSheet from './MoveSheet.svelte';
	import { bulkToggles, snoozePresets } from '#lib/utils/thread-actions.js';

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
		label: 'Labels…',
		move: 'Move to…',
		snooze: 'Snooze…',
		spam: 'Report spam',
		mute: 'Mute',
		unmute: 'Unmute',
		snoozeTitle: 'Snooze until'
	};

	interface Props {
		/** The selected threads. */
		threads: readonly ThreadSummary[];
		/** The account's labels, for the label picker. */
		labels: readonly Label[];
		/** Runs an op, or several as one change, on the whole selection. */
		onapply: (op: ThreadOp | ThreadOp[]) => void;
		/** Creates a label from the picker. */
		oncreatelabel?: (name: string) => Promise<Label>;
		/** Puts read/unread in the bar instead of the More sheet, as the thread view does. */
		readInBar?: boolean;
	}

	let { threads, labels, onapply, oncreatelabel, readInBar = false }: Props = $props();

	// Snooze is a quick picker until T8.4.
	let sheet = $state<'more' | 'labels' | 'move' | 'snooze' | null>(null);

	const toggles = $derived(bulkToggles(threads));
	const isEmpty = $derived(threads.length === 0);

	const readIcon = $derived(toggles.read.op === 'markRead' ? MailOpen : Mail);
	// In the list bar read state sits in More, so the bar fits a 360px phone next to the count.
	const more = $derived<ActionSheetItem[]>([
		...(readInBar
			? []
			: [{ label: COPY[toggles.read.op], icon: readIcon, onselect: () => onapply(toggles.read) }]),
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
			disabled: labels.length === 0 && !oncreatelabel,
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
{#if readInBar}
	<IconButton
		icon={readIcon}
		label={COPY[toggles.read.op]}
		disabled={isEmpty}
		onclick={() => onapply(toggles.read)}
	/>
{/if}
<IconButton
	icon={EllipsisVertical}
	label={COPY.more}
	disabled={isEmpty}
	aria-haspopup="dialog"
	onclick={() => (sheet = 'more')}
/>

<ActionSheet open={sheet === 'more'} title={COPY.more} hideTitle actions={more} onclose={close} />
<LabelPicker
	open={sheet === 'labels'}
	{threads}
	{labels}
	oncreate={oncreatelabel}
	onapply={(ops) => onapply(ops)}
	onclose={close}
/>
<MoveSheet open={sheet === 'move'} {labels} onmove={(ops) => onapply(ops)} onclose={close} />
<ActionSheet
	open={sheet === 'snooze'}
	title={COPY.snoozeTitle}
	actions={snoozeItems}
	onclose={close}
/>
