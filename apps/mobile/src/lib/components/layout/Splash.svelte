<script lang="ts">
	import { APP_NAME, APP_TAGLINE } from '@nem/shared';
	import AuroraBackground from '#components/ui/AuroraBackground.svelte';
	import Button from '#components/ui/Button.svelte';
	import ErrorState from '#components/ui/ErrorState.svelte';
	import { fadeScale } from '#lib/motion/index.js';

	const LOADING_LABEL = 'Opening Nem Mail…';
	const ERROR_TITLE = "Couldn't open your mail";
	const WAKING_LABEL = 'Waking up the server…';
	const WAKING_HINT = 'The free server sleeps when idle. It can take up to a minute.';
	const OFFLINE_DEMO = 'Use the offline demo';

	interface Props {
		/** Shown with a Retry button when starting up failed. */
		error?: string | null;
		onretry?: () => void;
		/** Cold start: `waking` says so; `slow` also offers the offline demo. */
		waking?: 'waking' | 'slow' | null;
		onofflinedemo?: () => void;
	}

	let { error = null, onretry, waking = null, onofflinedemo }: Props = $props();
</script>

<!-- First launch (F1): the aurora plays while the session restores. -->
<div class="splash" out:fadeScale={{ start: 1.04 }}>
	<AuroraBackground position="absolute" />
	<div class="content">
		<h1 class="nm-text-display nm-text-gradient">{APP_NAME}</h1>
		<p class="nm-text-body-lg nm-text-muted">{APP_TAGLINE}</p>
		{#if error}
			<ErrorState title={ERROR_TITLE} message={error} {onretry} />
		{:else}
			<p class="status" role="status">
				<span class="pulse" aria-hidden="true"></span>
				{#if waking}
					<span class="nm-text-body">{WAKING_LABEL}</span>
				{:else}
					<span class="nm-visually-hidden">{LOADING_LABEL}</span>
				{/if}
			</p>
			{#if waking}
				<p class="nm-text-caption nm-text-muted">{WAKING_HINT}</p>
			{/if}
			{#if waking === 'slow' && onofflinedemo}
				<Button variant="glass" onclick={onofflinedemo}>{OFFLINE_DEMO}</Button>
			{/if}
		{/if}
	</div>
</div>

<style>
	.splash {
		position: fixed;
		inset: 0;
		z-index: var(--nm-z-modal);
		display: grid;
		place-items: center;
		background: var(--nm-color-bg);
	}
	.content {
		position: relative;
		display: grid;
		justify-items: center;
		gap: var(--nm-space-3);
		padding-inline: var(--nm-space-5);
		text-align: center;
	}
	h1,
	p {
		margin: 0;
	}
	.status {
		min-block-size: var(--nm-size-touch);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--nm-space-3);
	}
	.pulse {
		inline-size: var(--nm-space-3);
		block-size: var(--nm-space-3);
		border-radius: var(--nm-radius-round);
		background: var(--nm-color-accent-text);
		animation: pulse var(--nm-duration-slower) var(--nm-ease-standard) infinite alternate;
	}
	@keyframes pulse {
		from {
			opacity: 0.3;
			transform: scale(0.8);
		}
		to {
			opacity: 1;
			transform: scale(1.2);
		}
	}
</style>
