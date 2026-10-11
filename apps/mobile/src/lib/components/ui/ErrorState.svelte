<script lang="ts">
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Button from './Button.svelte';
	import EmptyState from './EmptyState.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		title?: string;
		message?: string;
		/** Shows a Retry button when given. */
		onretry?: () => void;
		/** Spinner on the Retry button while the retry runs. */
		retrying?: boolean;
		retryLabel?: string;
		class?: string;
	}

	let {
		title = 'Something went wrong',
		message = 'We could not load this. Check your connection and try again.',
		onretry,
		retrying = false,
		retryLabel = 'Try again',
		class: className
	}: Props = $props();
</script>

{#snippet retry()}
	<Button variant="glass" loading={retrying} onclick={onretry}>
		{#snippet leading()}<Icon icon={RotateCw} />{/snippet}
		{retryLabel}
	</Button>
{/snippet}

<div role="alert" class={className}>
	<EmptyState {title} {message} illustration="error" action={onretry ? retry : undefined} />
</div>
