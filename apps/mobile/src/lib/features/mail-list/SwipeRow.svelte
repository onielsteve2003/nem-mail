<script lang="ts">
	import Archive from '@lucide/svelte/icons/archive';
	import Clock from '@lucide/svelte/icons/clock';
	import FolderInput from '@lucide/svelte/icons/folder-input';
	import Mail from '@lucide/svelte/icons/mail';
	import MailOpen from '@lucide/svelte/icons/mail-open';
	import Trash from '@lucide/svelte/icons/trash';
	import type { SwipeAction } from '@nem/shared';
	import type { Snippet } from 'svelte';
	import { Spring } from 'svelte/motion';
	import Icon from '#components/ui/Icon.svelte';
	import { DURATIONS, springPreset } from '#lib/motion/index.js';
	import { hapticTick } from '#lib/utils/haptics.js';
	import {
		SWIPE_THRESHOLD,
		dragOffset,
		isArmed,
		lockAxis,
		removesRow,
		shouldCommit,
		swipeSide,
		type SwipeSide
	} from './swipe.js';

	type Tone = 'lime' | 'danger' | 'accent' | 'amber' | 'cyan';
	type Reveal = { label: string; icon: typeof Archive; tone: Tone };

	const REVEALS: Record<Exclude<SwipeAction, 'none' | 'toggleRead'>, Reveal> = {
		archive: { label: 'Archive', icon: Archive, tone: 'lime' },
		delete: { label: 'Delete', icon: Trash, tone: 'danger' },
		snooze: { label: 'Snooze', icon: Clock, tone: 'amber' },
		move: { label: 'Move', icon: FolderInput, tone: 'cyan' }
	};
	const MARK_READ: Reveal = { label: 'Mark read', icon: MailOpen, tone: 'accent' };
	const MARK_UNREAD: Reveal = { label: 'Mark unread', icon: Mail, tone: 'accent' };

	interface Props {
		/** The action for each swipe direction, from Settings. */
		actions: Record<SwipeSide, SwipeAction>;
		/** Picks the read/unread wording for `toggleRead`. */
		isUnread: boolean;
		disabled?: boolean;
		onswipe: (action: SwipeAction) => void;
		children: Snippet;
	}

	let { actions, isUnread, disabled = false, onswipe, children }: Props = $props();

	interface Drag {
		pointerId: number;
		startX: number;
		startY: number;
		axis: 'x' | 'y' | null;
		lastX: number;
		lastTime: number;
		velocity: number;
	}

	let width = $state(0);
	let front = $state<HTMLDivElement>();
	let drag: Drag | null = null;
	let isDragging = $state(false);
	let armed = $state(false);
	// A swipe ends with a click on the row's link; this swallows it.
	let didSwipe = false;
	const x = new Spring(0, springPreset('snappy'));

	const side = $derived(swipeSide(x.current));
	const action = $derived(side ? actions[side] : 'none');
	const reveal = $derived(
		action === 'none'
			? null
			: action === 'toggleRead'
				? isUnread
					? MARK_READ
					: MARK_UNREAD
				: REVEALS[action]
	);
	const progress = $derived(
		width > 0 ? Math.min(1, Math.abs(x.current) / (width * SWIPE_THRESHOLD)) : 0
	);

	function onpointerdown(event: PointerEvent): void {
		didSwipe = false;
		if (disabled || !event.isPrimary || event.button !== 0) return;
		drag = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			axis: null,
			lastX: event.clientX,
			lastTime: event.timeStamp,
			velocity: 0
		};
	}

	function onpointermove(event: PointerEvent): void {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const dx = event.clientX - drag.startX;
		if (!drag.axis) {
			drag.axis = lockAxis(dx, event.clientY - drag.startY);
			if (drag.axis === 'y') {
				drag = null;
				return;
			}
			if (!drag.axis) return;
			front?.setPointerCapture(event.pointerId);
			didSwipe = true;
			isDragging = true;
		}
		const elapsed = event.timeStamp - drag.lastTime;
		if (elapsed > 0) drag.velocity = (event.clientX - drag.lastX) / elapsed;
		drag.lastX = event.clientX;
		drag.lastTime = event.timeStamp;
		const next = isArmed(dx, width) && dragOffset(dx, width, actions) !== 0;
		if (next && !armed) hapticTick();
		armed = next;
		x.target = dragOffset(dx, width, actions);
	}

	async function end(event: PointerEvent, isCancel: boolean): Promise<void> {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const { axis, startX, velocity } = drag;
		drag = null;
		isDragging = false;
		armed = false;
		if (axis !== 'x') return;
		const dx = event.clientX - startX;
		const swiped = swipeSide(dx);
		const chosen = swiped ? actions[swiped] : 'none';
		if (isCancel || chosen === 'none' || !shouldCommit(dx, velocity, width)) {
			x.target = 0;
			return;
		}
		if (removesRow(chosen)) {
			await x.set(Math.sign(dx) * width);
			onswipe(chosen);
			// The row collapses off-screen; the reset waits for that so it is never seen,
			// and a row that comes back (rollback) is back in place.
			setTimeout(() => void x.set(0, { instant: true }), DURATIONS.base);
		} else {
			onswipe(chosen);
			x.target = 0;
		}
	}

	function onclickcapture(event: MouseEvent): void {
		if (!didSwipe) return;
		didSwipe = false;
		event.preventDefault();
		event.stopPropagation();
	}
</script>

<div class="swipe" bind:clientWidth={width}>
	{#if reveal}
		<div
			class={['reveal', `reveal--${reveal.tone}`, `reveal--${side}`, armed && 'reveal--armed']}
			style:opacity={progress}
			aria-hidden="true"
		>
			<span class="reveal__content">
				<Icon icon={reveal.icon} />
				<span class="nm-text-label">{reveal.label}</span>
			</span>
		</div>
	{/if}
	<!-- The swipe is a pointer shortcut over the row's own link and buttons, which keep
	     their roles; the same actions are in the row menus (T5.9). -->
	<div
		role="presentation"
		class={['front', isDragging && 'front--dragging']}
		bind:this={front}
		style:transform="translateX({x.current}px)"
		{onpointerdown}
		{onpointermove}
		onpointerup={(event) => void end(event, false)}
		onpointercancel={(event) => void end(event, true)}
		{onclickcapture}
	>
		{@render children()}
	</div>
</div>

<style>
	.swipe {
		position: relative;
		overflow: hidden;
	}
	.front {
		position: relative;
		background: var(--nm-color-bg);
		/* Vertical scrolling stays native; horizontal moves come to the pointer handlers. */
		touch-action: pan-y;
	}
	.front--dragging {
		user-select: none;
	}
	.reveal {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		padding-inline: var(--nm-space-6);
		color: var(--nm-color-on-aurora);
	}
	/* Swiping left uncovers the right edge, and the other way round. */
	.reveal--left {
		justify-content: flex-end;
	}
	.reveal--right {
		justify-content: flex-start;
	}
	.reveal--lime {
		background: var(--nm-color-lime);
	}
	.reveal--amber {
		background: var(--nm-color-amber);
	}
	.reveal--cyan {
		background: var(--nm-color-cyan);
	}
	.reveal--danger {
		background: var(--nm-color-danger-fill);
		color: var(--nm-color-on-danger);
	}
	.reveal--accent {
		background: var(--nm-color-accent);
		color: var(--nm-color-on-accent);
	}
	.reveal__content {
		display: inline-flex;
		align-items: center;
		gap: var(--nm-space-2);
		transform: scale(0.8);
		transition: transform var(--nm-duration-fast) var(--nm-ease-spring);
	}
	.reveal--armed .reveal__content {
		transform: scale(1.15);
	}
</style>
