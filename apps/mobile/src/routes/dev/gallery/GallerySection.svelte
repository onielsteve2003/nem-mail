<script lang="ts">
	import type { Snippet } from 'svelte';
	import SectionHeader from '#components/ui/SectionHeader.svelte';

	interface Props {
		title: string;
		children: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<section class="gallery-section">
	<SectionHeader {title} />
	<div class="gallery-section__body">{@render children()}</div>
</section>

<style>
	.gallery-section {
		padding-block: var(--nm-space-4);
		border-block-start: 1px solid var(--nm-color-border);
	}
	.gallery-section__body {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nm-space-3);
		padding-inline: var(--nm-space-4);
	}
	.gallery-section__body > :global(.gallery-block) {
		flex-basis: 100%;
	}
</style>
