<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { fadeScale } from '#lib/motion/index.js';
	import { getFocusable } from '#lib/utils/overlay.js';
	import {
		placePopover,
		pointToRect,
		type Point,
		type PopoverPlacement
	} from '#lib/utils/popover.js';

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
		open?: boolean;
		/** The element the panel points at, or a screen point (long-press). Focus returns to an element anchor. */
		anchor?: HTMLElement | Point;
		placement?: PopoverPlacement;
		children: Snippet;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		anchor,
		placement = 'bottom-start',
		children,
		onclose,
		class: className,
		...rest
	}: Props = $props();

	let panel = $state<HTMLDivElement>();
	let position = $state<{ top: number; left: number; placement: PopoverPlacement }>();

	function anchorElement(): HTMLElement | undefined {
		return anchor instanceof HTMLElement ? anchor : undefined;
	}

	function reposition() {
		if (!panel || !anchor) return;
		const rect =
			anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : pointToRect(anchor);
		position = placePopover(
			rect,
			{ width: panel.offsetWidth, height: panel.offsetHeight },
			{ width: window.innerWidth, height: window.innerHeight },
			placement
		);
	}

	function close(returnFocus: boolean) {
		if (!open) return;
		open = false;
		onclose?.();
		if (returnFocus) anchorElement()?.focus();
	}

	// Measure once the panel is in the DOM, then move focus inside it. The panel is
	// hidden until positioned, and hidden elements cannot take focus, so wait a tick.
	$effect(() => {
		const node = panel;
		if (!node) {
			position = undefined;
			return;
		}
		reposition();
		void tick().then(() => {
			if (!open) return;
			const initial = node.querySelector<HTMLElement>('[data-autofocus]') ?? getFocusable(node)[0];
			(initial ?? node).focus();
		});
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.stopPropagation();
			close(true);
		}
	}

	function handleFocusout(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;
		// Tabbing away closes the popover; focus stays where the user sent it.
		if (next && panel && !panel.contains(next)) close(false);
	}

	function handleOutsidePointer(event: PointerEvent) {
		if (!open || !panel) return;
		const target = event.target as Node;
		// Taps on the anchor are left to its own toggle handler.
		if (panel.contains(target) || anchorElement()?.contains(target)) return;
		close(false);
	}
</script>

<svelte:document onpointerdown={handleOutsidePointer} />
<svelte:window onresize={() => open && reposition()} onscrollcapture={() => open && reposition()} />

{#if open && anchor}
	<div
		{...rest}
		bind:this={panel}
		class={['popover', `popover--${position?.placement ?? placement}`, className]}
		style:top={position ? `${position.top}px` : undefined}
		style:left={position ? `${position.left}px` : undefined}
		style:visibility={position ? undefined : 'hidden'}
		tabindex="-1"
		onkeydown={handleKeydown}
		onfocusout={handleFocusout}
		transition:fadeScale
	>
		{@render children()}
	</div>
{/if}

<style>
	.popover {
		position: fixed;
		inset-block-start: 0;
		inset-inline-start: 0;
		z-index: var(--nm-z-popover);
		min-inline-size: 12rem;
		max-inline-size: min(20rem, calc(100vw - var(--nm-space-6)));
		max-block-size: calc(var(--nm-viewport-height, 100dvh) - var(--nm-space-6));
		overflow-y: auto;
		padding: var(--nm-space-2);
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-lg);
		background: var(--nm-color-surface-3);
		box-shadow: var(--nm-shadow-3);
		color: var(--nm-color-text);
		outline: none;
	}
	/* Grow out of the corner nearest the anchor. Positions use physical px, so origins do too. */
	.popover--bottom-start {
		transform-origin: top left;
	}
	.popover--bottom-end {
		transform-origin: top right;
	}
	.popover--top-start {
		transform-origin: bottom left;
	}
	.popover--top-end {
		transform-origin: bottom right;
	}
</style>
