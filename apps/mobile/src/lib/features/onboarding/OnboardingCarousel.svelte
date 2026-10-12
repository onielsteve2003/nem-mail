<script lang="ts">
	import Hand from '@lucide/svelte/icons/hand';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Button from '#components/ui/Button.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import { prefersReducedMotion } from '#lib/motion/index.js';
	import { ONBOARDING_SLIDES } from './slides.js';

	const CAROUSEL_LABEL = 'Welcome to Nem Mail';
	const NEXT_LABEL = 'Next';
	const START_LABEL = 'Try the demo';
	const ICONS = { inbox: Inbox, ai: Sparkles, gestures: Hand };

	interface Props {
		/** Signs in to the demo account. */
		onstart: () => void;
		starting?: boolean;
		error?: string | null;
	}

	let { onstart, starting = false, error = null }: Props = $props();

	let track: HTMLDivElement;
	let active = $state(0);
	const isLast = $derived(active === ONBOARDING_SLIDES.length - 1);

	function onscroll(): void {
		active = Math.round(track.scrollLeft / track.clientWidth);
	}

	function goTo(index: number): void {
		const behavior = prefersReducedMotion() ? 'instant' : 'smooth';
		track.scrollTo({ left: index * track.clientWidth, behavior });
		active = index;
	}
</script>

<section class="carousel" aria-roledescription="carousel" aria-label={CAROUSEL_LABEL}>
	<!-- Native scroll snapping gives the swipe, momentum and arrow-key scrolling. -->
	<div class="track" bind:this={track} {onscroll} tabindex="-1">
		{#each ONBOARDING_SLIDES as slide, index (slide.id)}
			<div
				class="slide"
				role="group"
				aria-roledescription="slide"
				aria-label={`${index + 1} of ${ONBOARDING_SLIDES.length}`}
				inert={index !== active}
			>
				<div class="art"><Icon icon={ICONS[slide.id]} size="xl" /></div>
				<h1 class="nm-text-title-1">{slide.title}</h1>
				<p class="nm-text-body-lg nm-text-muted">{slide.body}</p>
			</div>
		{/each}
	</div>

	<div class="dots">
		{#each ONBOARDING_SLIDES as slide, index (slide.id)}
			<button
				type="button"
				class="dot"
				aria-label={`Slide ${index + 1}: ${slide.title}`}
				aria-current={index === active ? 'step' : undefined}
				onclick={() => goTo(index)}
			>
				<span></span>
			</button>
		{/each}
	</div>

	{#if error}<p class="error" role="alert">{error}</p>{/if}

	<div class="actions">
		{#if !isLast}
			<Button variant="ghost" size="lg" onclick={() => goTo(active + 1)}>{NEXT_LABEL}</Button>
		{/if}
		<Button size="lg" loading={starting} onclick={onstart}>{START_LABEL}</Button>
	</div>
</section>

<style>
	.carousel {
		display: grid;
		grid-template-rows: 1fr auto auto auto;
		gap: var(--nm-space-4);
		block-size: 100%;
	}
	.track {
		display: flex;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		overscroll-behavior-x: contain;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	.slide {
		flex: 0 0 100%;
		scroll-snap-align: start;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: var(--nm-space-3);
		padding-inline: var(--nm-space-6);
		text-align: center;
	}
	.slide h1,
	.slide p {
		margin: 0;
		max-inline-size: 22rem;
	}
	.art {
		display: grid;
		place-items: center;
		inline-size: var(--nm-space-11);
		block-size: var(--nm-space-11);
		margin-block-end: var(--nm-space-3);
		border-radius: var(--nm-radius-xl);
		background: var(--nm-color-accent-soft);
		color: var(--nm-color-accent-text);
	}
	.dots {
		display: flex;
		justify-content: center;
	}
	.dot {
		display: grid;
		place-items: center;
		inline-size: var(--nm-size-touch);
		block-size: var(--nm-size-touch);
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.dot span {
		inline-size: var(--nm-space-2);
		block-size: var(--nm-space-2);
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-border-strong);
		transition:
			transform var(--nm-duration-base) var(--nm-ease-standard),
			background-color var(--nm-duration-base) var(--nm-ease-standard);
	}
	.dot[aria-current] span {
		background: var(--nm-color-accent-text);
		transform: scale(1.5);
	}
	.error {
		margin: 0;
		padding-inline: var(--nm-space-6);
		color: var(--nm-color-danger);
		text-align: center;
	}
	.actions {
		display: flex;
		gap: var(--nm-space-3);
		padding-inline: var(--nm-space-5);
	}
	.actions :global(> *) {
		flex: 1;
	}
</style>
