<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import { Spring } from 'svelte/motion';
	import { fadeScale, sheetIn, springPreset } from '#lib/motion/index.js';
	import { overlay } from '#lib/utils/overlay.js';
	import { resolveSnap, snapOffsets } from '#lib/utils/sheet.js';

	const RESIZE_LABEL = 'Resize sheet';
	/** Movement (px) before a press on the header counts as a drag, not a tap. */
	const DRAG_SLOP = 4;
	/** Dragging above the fully open position only moves this share of the finger. */
	const OVERDRAG_RESISTANCE = 0.2;

	interface Props {
		open?: boolean;
		/** Names the dialog. Hide it visually with hideTitle when the content has its own heading. */
		title: string;
		hideTitle?: boolean;
		/** Heights as viewport fractions, e.g. [0.5, 0.92]. Leave out for a content-sized sheet. */
		snapPoints?: number[];
		onclose?: () => void;
		children: Snippet;
		class?: string;
	}

	let {
		open = $bindable(false),
		title,
		hideTitle = false,
		snapPoints,
		onclose,
		children,
		class: className
	}: Props = $props();

	const titleId = $props.id();
	const points = $derived(snapPoints ? [...snapPoints].sort((a, b) => a - b) : []);
	const maxPoint = $derived(points.length ? Math.max(...points) : 0);

	let sheet = $state<HTMLElement>();
	let snapIndex = $state(0);
	/** Extra px on top of the current snap position: the live drag, or a settle after one. */
	const drag = new Spring(0, springPreset('gentle'));

	let gesture: {
		startY: number;
		lastY: number;
		lastTime: number;
		velocity: number;
		moved: boolean;
	} | null = null;
	let suppressClick = false;

	// Every open starts at the first snap point with no leftover drag.
	$effect.pre(() => {
		if (open)
			untrack(() => {
				snapIndex = 0;
				drag.set(0, { instant: true });
			});
	});

	function close() {
		if (!open) return;
		open = false;
		onclose?.();
	}

	function offsetAt(index: number): number {
		return snapOffsets(points, window.innerHeight)[index] ?? 0;
	}

	function snapTo(index: number) {
		const from = offsetAt(snapIndex) + drag.current;
		snapIndex = index;
		drag.set(from - offsetAt(index), { instant: true });
		drag.target = 0;
	}

	function cycleSnap() {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		snapTo((snapIndex + 1) % points.length);
	}

	function handleStart(event: PointerEvent) {
		if (event.button !== 0) return;
		gesture = {
			startY: event.clientY,
			lastY: event.clientY,
			lastTime: event.timeStamp,
			velocity: 0,
			moved: false
		};
	}

	function handleMove(event: PointerEvent) {
		if (!gesture) return;
		const dy = event.clientY - gesture.startY;
		if (Math.abs(dy) > DRAG_SLOP) gesture.moved = true;
		const elapsed = event.timeStamp - gesture.lastTime;
		if (elapsed > 0) gesture.velocity = (event.clientY - gesture.lastY) / elapsed;
		gesture.lastY = event.clientY;
		gesture.lastTime = event.timeStamp;

		const base = offsetAt(snapIndex);
		const position = base + dy;
		const resisted = position < 0 ? position * OVERDRAG_RESISTANCE : position;
		drag.set(resisted - base, { instant: true });
	}

	function handleEnd() {
		if (!gesture) return;
		const { moved, velocity } = gesture;
		gesture = null;
		if (!moved) return;
		suppressClick = true;
		// A drag ends with a click on the handle in some browsers; ignore only that one.
		setTimeout(() => (suppressClick = false));

		const offsets = snapOffsets(points, window.innerHeight);
		const index = resolveSnap({
			position: offsetAt(snapIndex) + drag.current,
			velocity,
			offsets,
			sheetHeight: sheet?.offsetHeight ?? 0
		});
		if (index === -1) close();
		else snapTo(index);
	}

	const transform = $derived(
		`translateY(calc(${maxPoint - (points[snapIndex] ?? maxPoint)} * var(--nm-viewport-height) + ${drag.current}px))`
	);
</script>

<svelte:window onpointermove={handleMove} onpointerup={handleEnd} onpointercancel={handleEnd} />

{#if open}
	<div class="layer">
		<!-- Tapping the scrim closes; keyboard users close with Escape. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="scrim" transition:fadeScale={{ start: 1 }} onclick={close}></div>
		<div class="frame" transition:sheetIn>
			<div
				bind:this={sheet}
				class={['sheet', className]}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabindex="-1"
				style:transform
				style:block-size={points.length
					? `calc(${maxPoint} * var(--nm-viewport-height))`
					: undefined}
				use:overlay={{ onescape: close }}
			>
				<!-- Dragging is a pointer gesture; the handle button and Escape are the alternatives. -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="header" onpointerdown={handleStart}>
					{#if points.length > 1}
						<button type="button" class="handle" aria-label={RESIZE_LABEL} onclick={cycleSnap}>
							<span class="grip"></span>
						</button>
					{:else}
						<span class="handle"><span class="grip"></span></span>
					{/if}
					<h2 id={titleId} class={['title', { 'nm-visually-hidden': hideTitle }]}>{title}</h2>
				</div>
				<div class="body">{@render children()}</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.layer {
		position: fixed;
		inset: 0;
		z-index: var(--nm-z-sheet);
	}
	.scrim {
		position: absolute;
		inset: 0;
		background: var(--nm-color-scrim);
	}
	.frame {
		position: absolute;
		inset-inline: 0;
		/* Sits above an overlaid keyboard so the focused field stays in view. */
		inset-block-end: var(--nm-keyboard-inset);
		display: flex;
		justify-content: center;
		pointer-events: none;
	}
	.sheet {
		display: flex;
		flex-direction: column;
		inline-size: min(100%, 40rem);
		max-block-size: calc(
			var(--nm-viewport-height) - var(--nm-safe-top) - var(--nm-space-6) - var(--nm-keyboard-inset)
		);
		border: 1px solid var(--nm-color-border);
		border-block-end: 0;
		border-start-start-radius: var(--nm-radius-2xl);
		border-start-end-radius: var(--nm-radius-2xl);
		background: var(--nm-color-surface-2);
		box-shadow: var(--nm-shadow-4);
		color: var(--nm-color-text);
		pointer-events: auto;
		outline: none;
		will-change: transform;
	}
	.header {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-inline: var(--nm-space-5);
		padding-block-end: var(--nm-space-2);
		touch-action: none;
		cursor: grab;
		user-select: none;
	}
	.handle {
		display: grid;
		place-items: center;
		inline-size: var(--nm-size-control-lg);
		block-size: var(--nm-size-touch);
		padding: 0;
		border: 0;
		border-radius: var(--nm-radius-pill);
		background: none;
		cursor: inherit;
	}
	.grip {
		inline-size: var(--nm-space-8);
		block-size: var(--nm-space-1);
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-border-strong);
	}
	.title {
		align-self: stretch;
		margin: 0;
		font-family: var(--nm-font-display);
		font-size: var(--nm-text-title-3);
		font-weight: var(--nm-weight-semibold);
	}
	.body {
		flex: 1;
		min-block-size: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-inline: var(--nm-space-5);
		padding-block-end: calc(var(--nm-space-5) + var(--nm-safe-bottom));
	}
</style>
