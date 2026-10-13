<script lang="ts">
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import Copy from '@lucide/svelte/icons/copy';
	import Truck from '@lucide/svelte/icons/truck';
	import type { Extraction } from '@nem/shared';
	import type { ExtractionVerdict } from '#lib/ai/models/extract.js';
	import AIBadge from '#components/ui/AIBadge.svelte';
	import Chip from '#components/ui/Chip.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import { toastStore } from '#lib/stores/toast.svelte.js';
	import { downloadBlob } from '#lib/utils/files.js';
	import { buildIcs, trackingUrl, whenLabel } from './extraction.js';

	const LABEL = 'Quick actions';
	const COPIED = 'Code copied';
	const COPY_FAILED = "Couldn't copy the code";
	const CALENDAR_SAVED = 'Calendar file saved. Open it to add the event.';

	interface Props {
		verdict: ExtractionVerdict;
		/** Names the calendar event. */
		subject: string;
	}

	let { verdict, subject }: Props = $props();

	const labelId = $props.id();

	function chipText(item: Extraction): string {
		if (item.kind === 'otp') return `Copy code ${item.value}`;
		if (item.kind === 'tracking') return `Track ${item.value}`;
		return `Add to calendar: ${whenLabel(item.value)}`;
	}

	async function copy(code: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(code);
			toastStore.show({ message: COPIED });
		} catch {
			toastStore.show({ message: COPY_FAILED, tone: 'error' });
		}
	}

	function addToCalendar(item: Extraction): void {
		const ics = buildIcs(item, subject || 'Event');
		downloadBlob(new Blob([ics], { type: 'text/calendar' }), 'nem-mail-event.ics');
		toastStore.show({ message: CALENDAR_SAVED });
	}

	function act(item: Extraction): void {
		if (item.kind === 'otp') void copy(item.value);
		else if (item.kind === 'tracking')
			window.open(trackingUrl(item.value), '_blank', 'noopener,noreferrer');
		else addToCalendar(item);
	}
</script>

<!-- AI-10: codes, tracking numbers, and dates found in the message, one tap to act. -->
<section class="extraction" aria-labelledby={labelId}>
	<div class="extraction__header">
		<AIBadge insight={verdict} />
		<h3 id={labelId} class="extraction__title nm-text-label">{LABEL}</h3>
	</div>
	<ul class="extraction__chips">
		{#each verdict.value as item (`${item.kind}:${item.value}`)}
			<li>
				<Chip onclick={() => act(item)}>
					{#snippet leading()}
						<Icon
							icon={item.kind === 'otp' ? Copy : item.kind === 'tracking' ? Truck : CalendarPlus}
							size="sm"
						/>
					{/snippet}
					{chipText(item)}
				</Chip>
			</li>
		{/each}
	</ul>
</section>

<style>
	.extraction {
		display: grid;
		gap: var(--nm-space-2);
		padding-block: var(--nm-space-2);
		padding-inline: var(--nm-space-4);
	}
	.extraction__header {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
	}
	.extraction__title {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
	.extraction__chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nm-space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
