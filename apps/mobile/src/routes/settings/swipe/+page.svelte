<script lang="ts">
	import type { SwipeAction } from '@nem/shared';
	import { resolve } from '$app/paths';
	import Radio from '#components/ui/Radio.svelte';
	import SectionHeader from '#components/ui/SectionHeader.svelte';
	import { getRepositories } from '#lib/data/provider.js';
	import { removesRow, type SwipeSide } from '#features/mail-list/swipe.js';
	import SwipeRow from '#features/mail-list/SwipeRow.svelte';
	import { SettingsEditor } from '#features/settings/editor.svelte.js';
	import { SWIPE_OPTIONS, swipeLabel } from '#features/settings/general.js';
	import SettingsScreen from '#features/settings/SettingsScreen.svelte';
	import { DURATIONS } from '#lib/motion/index.js';

	const COPY = {
		title: 'Swipe actions',
		preview: 'Preview',
		hint: 'Swipe the row to try your choices. Nothing happens to your mail.',
		sender: 'Nem Mail',
		subject: 'Try a swipe',
		snippet: 'Drag this row left or right.',
		left: 'Swipe left',
		right: 'Swipe right',
		did: (action: string) => `Swiped: ${action}`
	};
	const SIDES: { side: SwipeSide; label: string }[] = [
		{ side: 'left', label: COPY.left },
		{ side: 'right', label: COPY.right }
	];

	const editor = new SettingsEditor(getRepositories().settings);
	void editor.load();

	let isUnread = $state(true);
	let last = $state<string | null>(null);
	// Re-mounting brings the row back after an action that flies it off.
	let previewKey = $state(0);

	function onswipe(action: SwipeAction): void {
		last = COPY.did(swipeLabel(action));
		if (action === 'toggleRead') isUnread = !isUnread;
		if (removesRow(action)) setTimeout(() => previewKey++, DURATIONS.slow);
	}

	function choose(side: SwipeSide, action: SwipeAction): void {
		void editor.update({ swipe: { ...editor.settings.swipe, [side]: action } });
	}
</script>

<SettingsScreen title={COPY.title} fallbackHref={resolve('/settings')}>
	<section class="group" aria-labelledby="preview">
		<SectionHeader id="preview" title={COPY.preview} />
		<p class="hint nm-text-caption">{COPY.hint}</p>
		<div class="preview">
			{#key previewKey}
				<SwipeRow actions={editor.settings.swipe} {isUnread} {onswipe}>
					<div class={['sample', { 'sample--unread': isUnread }]}>
						<span class="sample__avatar" aria-hidden="true">N</span>
						<span class="sample__text">
							<span class="sample__sender">{COPY.sender}</span>
							<span class="sample__subject">{COPY.subject}</span>
							<span class="sample__snippet nm-text-caption">{COPY.snippet}</span>
						</span>
					</div>
				</SwipeRow>
			{/key}
		</div>
		<p class="status nm-text-caption" role="status">{last ?? ''}</p>
	</section>

	{#each SIDES as { side, label } (side)}
		<section class="group" aria-labelledby="swipe-{side}">
			<SectionHeader id="swipe-{side}" title={label} />
			<div class="options" role="radiogroup" aria-labelledby="swipe-{side}">
				{#each SWIPE_OPTIONS as option (option.value)}
					<Radio
						name="swipe-{side}"
						label={option.label}
						value={option.value}
						group={editor.settings.swipe[side]}
						onchange={() => choose(side, option.value)}
					/>
				{/each}
			</div>
		</section>
	{/each}
</SettingsScreen>

<style>
	.group {
		display: grid;
		gap: var(--nm-space-3);
		padding: var(--nm-space-3) var(--nm-space-4);
	}
	.hint,
	.status {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
	.status {
		min-block-size: 1lh;
	}
	.preview {
		overflow: hidden;
		border-radius: var(--nm-radius-lg);
	}
	.sample {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
		padding: var(--nm-space-3) var(--nm-space-4);
		background: var(--nm-color-bg);
	}
	.sample__avatar {
		display: grid;
		place-items: center;
		flex: none;
		inline-size: 2.5rem;
		block-size: 2.5rem;
		border-radius: 50%;
		background: var(--nm-color-accent);
		color: var(--nm-color-on-accent);
		font-weight: 600;
	}
	.sample__text {
		display: grid;
		min-inline-size: 0;
	}
	.sample__subject,
	.sample__snippet {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sample__snippet {
		color: var(--nm-color-text-muted);
	}
	.sample--unread .sample__sender,
	.sample--unread .sample__subject {
		font-weight: 600;
	}
	.options {
		display: grid;
		gap: var(--nm-space-2);
	}
</style>
