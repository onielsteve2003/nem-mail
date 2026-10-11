<script lang="ts">
	import AuroraBackground from '#components/ui/AuroraBackground.svelte';
	import SegmentedControl from '#components/ui/SegmentedControl.svelte';
	import Toaster from '#components/ui/Toaster.svelte';
	import { getThemeStore } from '#lib/stores/theme.svelte.js';
	import type { ThemePreference } from '#lib/utils/theme.js';
	import ActionsGallery from './ActionsGallery.svelte';
	import InputsGallery from './InputsGallery.svelte';
	import OverlaysGallery from './OverlaysGallery.svelte';
	import StatesGallery from './StatesGallery.svelte';

	const THEMES = [
		{ value: 'system', label: 'System' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'light', label: 'Light' }
	] satisfies { value: ThemePreference; label: string }[];

	const theme = getThemeStore();
</script>

<svelte:head>
	<title>Component gallery · Nem Mail</title>
</svelte:head>

<AuroraBackground />

<main class="gallery">
	<header class="gallery__header">
		<h1 class="nm-text-title-1">Aurora Noir</h1>
		<p class="gallery__intro">Every design-system component. Switch the theme to check both.</p>
		<SegmentedControl
			label="Theme"
			options={THEMES}
			value={theme.preference}
			onchange={(next) => theme.setPreference(next)}
		/>
	</header>
	<ActionsGallery />
	<InputsGallery />
	<OverlaysGallery />
	<StatesGallery />
</main>

<Toaster />

<style>
	.gallery {
		position: relative;
		block-size: var(--nm-viewport-height, 100dvh);
		overflow-y: auto;
		padding-block: calc(var(--nm-safe-top, 0px) + var(--nm-space-6))
			calc(var(--nm-safe-bottom, 0px) + var(--nm-space-10));
	}
	.gallery__header {
		display: grid;
		gap: var(--nm-space-3);
		padding-inline: var(--nm-space-4);
		padding-block-end: var(--nm-space-4);
	}
	.gallery__header h1,
	.gallery__intro {
		margin: 0;
	}
	.gallery__intro {
		color: var(--nm-color-text-muted);
	}
</style>
