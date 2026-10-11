<script lang="ts" module>
	export type AvatarSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { getAvatarPalette, getInitials } from '#lib/utils/avatar.js';
	import Icon from './Icon.svelte';

	const SELECT_LABEL = (name: string) => `Select ${name}`;

	interface Props {
		/** Sender or contact name. Drives the initials, the gradient and the accessible name. */
		name: string;
		/** Photo URL. Falls back to the gradient and initials if it fails to load. */
		src?: string;
		size?: AvatarSize;
		/** Flips the avatar to show a check (multi-select). */
		selected?: boolean;
		/** Makes the avatar a toggle button (tap to select). */
		onclick?: (event: MouseEvent) => void;
		/** Accessible name of the toggle button. Defaults to "Select {name}". */
		label?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		name,
		src,
		size = 'md',
		selected = false,
		onclick,
		label,
		disabled = false,
		class: className
	}: Props = $props();

	// Synthetic clicks can still reach a disabled button, so guard here too (as Button does).
	function handleClick(event: MouseEvent) {
		if (!disabled) onclick?.(event);
	}

	const initials = $derived(getInitials(name));
	const palette = $derived(getAvatarPalette(name));
	// Remember which URL failed, so a new src gets a fresh attempt.
	let failedSrc = $state<string>();
	const showImage = $derived(src !== undefined && src !== failedSrc);

	const style = $derived(
		[
			`--avatar-from: var(--nm-color-${palette.from})`,
			`--avatar-to: var(--nm-color-${palette.to})`,
			`--avatar-blob: var(--nm-color-${palette.blob})`,
			`--avatar-angle: ${palette.angle}deg`,
			`--avatar-blob-x: ${palette.blobX}%`,
			`--avatar-blob-y: ${palette.blobY}%`
		].join('; ')
	);
</script>

{#snippet faces()}
	<span class="avatar__inner" class:avatar__inner--flipped={selected}>
		<span class="avatar__face avatar__front">
			{#if showImage}
				<img {src} alt="" loading="lazy" onerror={() => (failedSrc = src)} />
			{:else}
				<span class="avatar__initials">{initials}</span>
			{/if}
		</span>
		<span class="avatar__face avatar__back">
			<Icon icon={Check} size={size === 'lg' ? 'lg' : 'md'} />
		</span>
	</span>
{/snippet}

{#if onclick}
	<button
		type="button"
		class={['avatar-button', className]}
		aria-pressed={selected}
		aria-label={label ?? SELECT_LABEL(name)}
		{disabled}
		onclick={handleClick}
	>
		<span class="avatar avatar--{size}" {style} aria-hidden="true">{@render faces()}</span>
	</button>
{:else}
	<span class={['avatar', `avatar--${size}`, className]} {style} role="img" aria-label={name}>
		{@render faces()}
	</span>
{/if}

<style>
	.avatar {
		display: inline-block;
		flex-shrink: 0;
		inline-size: var(--nm-size-avatar-md);
		block-size: var(--nm-size-avatar-md);
		font-size: var(--nm-text-label);
		perspective: 30rem;
	}
	.avatar--sm {
		inline-size: var(--nm-size-avatar-sm);
		block-size: var(--nm-size-avatar-sm);
		font-size: var(--nm-text-caption);
	}
	.avatar--lg {
		inline-size: var(--nm-size-avatar-lg);
		block-size: var(--nm-size-avatar-lg);
		font-size: var(--nm-text-title-3);
	}

	.avatar__inner {
		position: relative;
		display: block;
		inline-size: 100%;
		block-size: 100%;
		transform-style: preserve-3d;
		transition: transform var(--nm-duration-slow) var(--nm-ease-spring);
	}
	.avatar__inner--flipped {
		transform: rotateY(180deg);
	}

	.avatar__face {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: var(--nm-radius-round);
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.avatar__front {
		background:
			radial-gradient(
				circle at var(--avatar-blob-x) var(--avatar-blob-y),
				var(--avatar-blob) 0,
				transparent 45%
			),
			linear-gradient(var(--avatar-angle), var(--avatar-from), var(--avatar-to));
		color: var(--nm-color-on-aurora);
	}
	.avatar__back {
		transform: rotateY(180deg);
		background: var(--nm-color-accent);
		color: var(--nm-color-on-accent);
	}

	.avatar__initials {
		font-family: var(--nm-font-display);
		font-weight: var(--nm-weight-bold);
		line-height: 1;
		letter-spacing: var(--nm-tracking-tight);
		user-select: none;
	}
	img {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
	}

	/* The visible avatar can be smaller than a touch target; the button never is. */
	.avatar-button {
		display: inline-grid;
		place-items: center;
		min-inline-size: var(--nm-size-touch);
		min-block-size: var(--nm-size-touch);
		padding: 0;
		border: 0;
		border-radius: var(--nm-radius-round);
		background: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.avatar-button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.avatar__inner {
			transition: none;
		}
	}
</style>
