<script lang="ts">
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Clock from '@lucide/svelte/icons/clock';
	import BottomSheet from '#components/ui/BottomSheet.svelte';
	import Button from '#components/ui/Button.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import {
		fromLocalIso,
		isValidSendAt,
		MIN_SCHEDULE_LEAD_MS,
		schedulePresets,
		scheduleTime,
		toLocalIso,
		yearsAhead
	} from './schedule.js';

	const COPY = {
		title: 'Schedule send',
		custom: 'Pick date and time',
		confirm: 'Schedule send',
		tooSoon: 'Pick a time at least a minute from now'
	};
	/** How far ahead the custom picker reaches. */
	const MAX_YEARS_AHEAD = 1;

	interface Props {
		open?: boolean;
		/** Reference time for presets and validation; tests pin it. */
		now?: () => Date;
		onschedule: (at: Date) => void;
		onclose?: () => void;
	}

	let { open = $bindable(false), now = () => new Date(), onschedule, onclose }: Props = $props();

	let isCustom = $state(false);
	let custom = $state<Date | null>(null);
	let error = $state('');
	const id = $props.id();

	// Presets and the picker's range are worked out when the sheet opens.
	const opened = $derived(open ? now() : new Date(0));
	const presets = $derived(schedulePresets(opened));
	const min = $derived(toLocalIso(new Date(opened.getTime() + MIN_SCHEDULE_LEAD_MS)));
	const max = $derived(toLocalIso(yearsAhead(opened, MAX_YEARS_AHEAD)));

	$effect(() => {
		if (open) return;
		isCustom = false;
		custom = null;
		error = '';
	});

	function close() {
		open = false;
		onclose?.();
	}

	function pick(at: Date) {
		close();
		onschedule(at);
	}

	function showCustom() {
		isCustom = true;
		custom ??= presets[0]?.at ?? null;
	}

	function confirmCustom() {
		if (!custom || !isValidSendAt(custom, now())) {
			error = COPY.tooSoon;
			return;
		}
		pick(custom);
	}

	function onchange(event: Event) {
		const { value } = (event as CustomEvent<{ value?: string | string[] | null }>).detail;
		custom = fromLocalIso(value);
		error = '';
	}
</script>

<BottomSheet bind:open title={COPY.title} {onclose}>
	{#if !isCustom}
		<ul class="list">
			{#each presets as preset (preset.id)}
				<li>
					<button type="button" class="item" onclick={() => pick(preset.at)}>
						<Icon icon={Clock} />
						<span class="item__text">
							<span>{preset.label}</span>
							<span class="item__time nm-text-caption">{scheduleTime(preset.at, opened)}</span>
						</span>
					</button>
				</li>
			{/each}
			<li>
				<button type="button" class="item" onclick={showCustom}>
					<Icon icon={CalendarClock} />
					<span class="item__text">{COPY.custom}</span>
				</button>
			</li>
		</ul>
	{:else}
		<div class="custom">
			<ion-datetime
				class="custom__picker"
				presentation="date-time"
				prefer-wheel="false"
				{min}
				{max}
				value={custom ? toLocalIso(custom) : min}
				aria-describedby={error ? `${id}-error` : undefined}
				onionChange={onchange}
			></ion-datetime>
			{#if error}
				<p id="{id}-error" class="custom__error nm-text-caption" role="alert">{error}</p>
			{/if}
			<Button onclick={confirmCustom}>
				{#snippet leading()}<Icon icon={CalendarClock} size="sm" />{/snippet}
				{COPY.confirm}
			</Button>
		</div>
	{/if}
</BottomSheet>

<style>
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--nm-space-4);
		inline-size: 100%;
		min-block-size: var(--nm-size-control-lg);
		padding-inline: var(--nm-space-3);
		border: none;
		border-radius: var(--nm-radius-md);
		background: transparent;
		color: var(--nm-color-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.item:hover,
	.item:active {
		background: var(--nm-color-glass);
	}
	.item__text {
		display: flex;
		flex-direction: column;
	}
	.item__time {
		color: var(--nm-color-text-muted);
	}
	.custom {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--nm-space-3);
	}
	.custom__picker {
		--background: transparent;
		inline-size: 100%;
		max-inline-size: none;
		color: var(--nm-color-text);
	}
	.custom__error {
		margin: 0;
		color: var(--nm-color-danger);
	}
</style>
