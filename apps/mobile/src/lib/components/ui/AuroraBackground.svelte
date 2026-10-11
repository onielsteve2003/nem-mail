<script lang="ts">
	interface Props {
		/** Cover the viewport (`fixed`) or the nearest positioned parent (`absolute`). */
		position?: 'fixed' | 'absolute';
		class?: string;
	}

	let { position = 'fixed', class: className }: Props = $props();

	let element: HTMLDivElement;
	let isTabHidden = $state(false);
	let isOffscreen = $state(false);
	const isPaused = $derived(isTabHidden || isOffscreen);

	// Pause the drift while nobody can see it: the tab is in the background or the
	// element is scrolled out of view. Saves battery on phones.
	$effect(() => {
		const onVisibility = () => (isTabHidden = document.hidden);
		onVisibility();
		document.addEventListener('visibilitychange', onVisibility);

		let observer: IntersectionObserver | undefined;
		if (typeof IntersectionObserver === 'function') {
			observer = new IntersectionObserver(([entry]) => {
				if (entry) isOffscreen = !entry.isIntersecting;
			});
			observer.observe(element);
		}

		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			observer?.disconnect();
		};
	});
</script>

<div
	bind:this={element}
	class={['aurora', `aurora--${position}`, className]}
	data-paused={isPaused}
	aria-hidden="true"
>
	<span class="blob blob--violet"></span>
	<span class="blob blob--cyan"></span>
	<span class="blob blob--lime"></span>
	<span class="blob blob--coral"></span>
</div>

<style>
	.aurora {
		--aurora-opacity: 0.5;
		inset: 0;
		z-index: var(--nm-z-base);
		overflow: hidden;
		pointer-events: none;
		contain: strict;
		background: var(--nm-color-bg);
	}
	:global(:root[data-theme='light']) .aurora {
		--aurora-opacity: 0.3;
	}
	.aurora--fixed {
		position: fixed;
	}
	.aurora--absolute {
		position: absolute;
	}

	/* Soft radial blobs that drift with transform only, so they stay on the compositor. */
	.blob {
		position: absolute;
		inline-size: 70vmax;
		block-size: 70vmax;
		border-radius: var(--nm-radius-round);
		background: radial-gradient(circle, var(--blob-color) 0%, transparent 65%);
		opacity: var(--aurora-opacity);
		will-change: transform;
		animation: drift var(--nm-duration-ambient) var(--nm-ease-standard) infinite alternate;
	}
	.aurora[data-paused='true'] .blob {
		animation-play-state: paused;
	}
	.blob--violet {
		--blob-color: var(--nm-color-violet);
		inset-block-start: -30vmax;
		inset-inline-start: -25vmax;
	}
	.blob--cyan {
		--blob-color: var(--nm-color-cyan);
		inset-block-start: -10vmax;
		inset-inline-end: -35vmax;
		animation-duration: calc(var(--nm-duration-ambient) * 1.3);
		animation-direction: alternate-reverse;
	}
	.blob--lime {
		--blob-color: var(--nm-color-lime);
		inset-block-end: -40vmax;
		inset-inline-start: -10vmax;
		opacity: calc(var(--aurora-opacity) * 0.6);
		animation-duration: calc(var(--nm-duration-ambient) * 0.8);
	}
	.blob--coral {
		--blob-color: var(--nm-color-coral);
		inset-block-end: -35vmax;
		inset-inline-end: -30vmax;
		opacity: calc(var(--aurora-opacity) * 0.5);
		animation-duration: calc(var(--nm-duration-ambient) * 1.1);
		animation-direction: alternate-reverse;
	}

	@keyframes drift {
		0% {
			transform: translate3d(0, 0, 0) scale(1);
		}
		50% {
			transform: translate3d(12vmax, 8vmax, 0) scale(1.15);
		}
		100% {
			transform: translate3d(-6vmax, 14vmax, 0) scale(0.95);
		}
	}

	/* Reduced motion: a still composition at the first keyframe. */
	@media (prefers-reduced-motion: reduce) {
		.blob {
			animation: none;
		}
	}
</style>
