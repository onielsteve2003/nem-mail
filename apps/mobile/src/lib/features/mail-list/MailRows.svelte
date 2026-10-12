<script lang="ts" generics="T extends { id: string }">
	import type { Snippet } from 'svelte';
	import Spinner from '#components/ui/Spinner.svelte';
	import { VIRTUALIZE_ABOVE, rowEstimate, virtualRange } from './virtual.js';

	const LOADING_MORE = 'Loading more conversations';
	// Fetch the next page while it is still this far below the viewport.
	const LOAD_MORE_MARGIN = '0px 0px 1200px 0px';
	// The list layout's scroller (it hosts the pull to refresh too).
	const SCROLL_HOST = '.ion-content-scroll-host';

	interface Props {
		items: T[];
		row: Snippet<[T]>;
		/** More pages exist on the server. */
		hasMore: boolean;
		isLoadingMore: boolean;
		onloadmore: () => void;
	}

	let { items, row, hasMore, isLoadingMore, onloadmore }: Props = $props();

	let rows = $state<HTMLUListElement>();
	let sentinel = $state<HTMLDivElement>();
	let heights = $state<Record<string, number>>({});
	let viewport = $state({ top: 0, height: 0 });

	const isVirtual = $derived(items.length > VIRTUALIZE_ABOVE);
	const range = $derived.by(() => {
		if (!isVirtual) return { start: 0, end: items.length, before: 0, after: 0 };
		const estimate = rowEstimate(Object.values(heights));
		const all = items.map((item) => heights[item.id] ?? estimate);
		return virtualRange(all, viewport.top, viewport.height);
	});
	const visible = $derived(items.slice(range.start, range.end));

	function scrollHost(node: HTMLElement): HTMLElement {
		return node.closest<HTMLElement>(SCROLL_HOST) ?? document.documentElement;
	}

	// Follows the scroll position while virtual, at most once per frame.
	$effect(() => {
		if (!isVirtual || !rows) return;
		const list = rows;
		const host = scrollHost(list);
		let frame = 0;
		const update = () => {
			frame = 0;
			const offset = host.getBoundingClientRect().top - list.getBoundingClientRect().top;
			viewport = { top: offset, height: host.clientHeight };
		};
		const schedule = () => (frame ||= requestAnimationFrame(update));
		update();
		host.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule);
		return () => {
			cancelAnimationFrame(frame);
			host.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
		};
	});

	// Real heights replace the estimate, so the spacers match the rows they stand for.
	const resizes =
		typeof ResizeObserver === 'undefined'
			? null
			: new ResizeObserver((entries) => {
					for (const entry of entries) {
						const id = (entry.target as HTMLElement).dataset.id;
						const height = entry.borderBoxSize[0]?.blockSize;
						if (id && height && heights[id] !== height) heights[id] = height;
					}
				});
	$effect(() => () => resizes?.disconnect());

	function measure(node: HTMLElement) {
		resizes?.observe(node);
		return { destroy: () => resizes?.unobserve(node) };
	}

	// Infinite scroll. Re-observing after each page fires at once if the sentinel
	// is still in view; a failed page waits for the next scroll or the toast's Retry.
	$effect(() => {
		if (!sentinel || !hasMore) return;
		void items.length;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) onloadmore();
			},
			{ root: scrollHost(sentinel), rootMargin: LOAD_MORE_MARGIN }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

<ul
	class="rows"
	bind:this={rows}
	style:padding-block-start="{range.before}px"
	style:padding-block-end="{range.after}px"
>
	{#each visible as item (item.id)}
		<li data-id={item.id} use:measure>{@render row(item)}</li>
	{/each}
</ul>
{#if hasMore}
	<div class="more" bind:this={sentinel}>
		{#if isLoadingMore}<Spinner size="sm" label={LOADING_MORE} />{/if}
	</div>
{/if}

<style>
	.rows {
		margin: 0;
		padding-inline: 0;
		list-style: none;
	}
	.more {
		display: flex;
		justify-content: center;
		min-block-size: var(--nm-size-control-sm);
		padding-block: var(--nm-space-3);
	}
</style>
