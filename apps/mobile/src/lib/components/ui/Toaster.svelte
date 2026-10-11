<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { sheetIn } from '#lib/motion/index.js';
	import { toastStore, type ToastStore } from '#lib/stores/toast.svelte.js';
	import IconButton from './IconButton.svelte';

	const DISMISS_LABEL = 'Dismiss';

	interface Props {
		/** Defaults to the app-wide queue; tests pass their own. */
		store?: ToastStore;
	}

	let { store = toastStore }: Props = $props();
</script>

<!-- The live region stays mounted so screen readers hear each new toast. -->
<div class="toaster" aria-live="polite">
	{#if store.current}
		{@const toast = store.current}
		{#key toast.id}
			<div
				class={['toast', `toast--${toast.tone}`]}
				role={toast.tone === 'error' ? 'alert' : 'status'}
				transition:sheetIn
				onpointerenter={() => store.pause()}
				onpointerleave={() => store.resume()}
				onfocusin={() => store.pause()}
				onfocusout={() => store.resume()}
			>
				<p class="message">{toast.message}</p>
				{#if toast.action}
					<button type="button" class="action" onclick={() => store.runAction(toast.id)}>
						{toast.action.label}
					</button>
				{/if}
				<IconButton
					icon={X}
					label={DISMISS_LABEL}
					size="sm"
					onclick={() => store.dismiss(toast.id)}
				/>
			</div>
		{/key}
	{/if}
</div>

<style>
	.toaster {
		position: fixed;
		inset-inline: 0;
		inset-block-end: 0;
		z-index: var(--nm-z-toast);
		display: grid;
		justify-items: center;
		padding-inline: calc(var(--nm-safe-left) + var(--nm-space-4))
			calc(var(--nm-safe-right) + var(--nm-space-4));
		padding-block-end: calc(var(--nm-safe-bottom) + var(--nm-space-4));
		pointer-events: none;
	}
	/* Leaving and entering toasts share one cell instead of stacking. */
	.toast {
		grid-area: 1 / 1;
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		inline-size: min(100%, 36rem);
		padding-block: var(--nm-space-1);
		padding-inline: var(--nm-space-4) var(--nm-space-1);
		border: 1px solid var(--nm-color-border-strong);
		border-inline-start-width: var(--nm-space-1);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-3);
		box-shadow: var(--nm-shadow-3);
		color: var(--nm-color-text);
		pointer-events: auto;
	}
	.toast--success {
		border-inline-start-color: var(--nm-color-success);
	}
	.toast--error {
		border-inline-start-color: var(--nm-color-danger);
	}
	.message {
		flex: 1;
		margin: 0;
		font-size: var(--nm-text-body);
		line-height: var(--nm-leading-normal);
	}
	.action {
		min-block-size: var(--nm-size-touch);
		padding-inline: var(--nm-space-3);
		border: 0;
		border-radius: var(--nm-radius-pill);
		background: none;
		color: var(--nm-color-accent-text);
		font: inherit;
		font-weight: var(--nm-weight-semibold);
		cursor: pointer;
	}
	.action:hover {
		background: var(--nm-color-accent-soft);
	}
</style>
