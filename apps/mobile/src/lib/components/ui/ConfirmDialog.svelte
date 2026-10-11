<script lang="ts">
	import Button from './Button.svelte';
	import Modal from './Modal.svelte';

	interface Props {
		open?: boolean;
		title: string;
		message?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		/** Red confirm button, for deleting or discarding. */
		destructive?: boolean;
		onconfirm: () => void;
		/** Called on Cancel, Escape or a scrim tap. */
		oncancel?: () => void;
	}

	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		destructive = false,
		onconfirm,
		oncancel
	}: Props = $props();

	function confirm() {
		open = false;
		onconfirm();
	}

	function cancel() {
		open = false;
		oncancel?.();
	}
</script>

<Modal
	bind:open
	{title}
	description={message}
	role="alertdialog"
	showClose={false}
	onclose={oncancel}
>
	{#snippet actions()}
		<!-- Focus starts on the safe choice, so a stray Enter never confirms. -->
		<Button variant="ghost" data-autofocus onclick={cancel}>{cancelLabel}</Button>
		<Button variant={destructive ? 'danger' : 'primary'} onclick={confirm}>{confirmLabel}</Button>
	{/snippet}
</Modal>
