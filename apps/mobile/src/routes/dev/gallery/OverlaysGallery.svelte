<script lang="ts">
	import Archive from '@lucide/svelte/icons/archive';
	import Reply from '@lucide/svelte/icons/reply';
	import Trash from '@lucide/svelte/icons/trash-2';
	import ActionSheet from '#components/ui/ActionSheet.svelte';
	import BottomSheet from '#components/ui/BottomSheet.svelte';
	import Button from '#components/ui/Button.svelte';
	import ConfirmDialog from '#components/ui/ConfirmDialog.svelte';
	import ContextMenu from '#components/ui/ContextMenu.svelte';
	import Modal from '#components/ui/Modal.svelte';
	import Popover from '#components/ui/Popover.svelte';
	import { toastStore } from '#lib/stores/toast.svelte.js';
	import GallerySection from './GallerySection.svelte';

	const ACTIONS = [
		{ label: 'Reply', icon: Reply, onselect: () => toastStore.show({ message: 'Reply' }) },
		{ label: 'Archive', icon: Archive, onselect: () => toastStore.show({ message: 'Archived' }) },
		{ label: 'Forward', disabled: true, onselect: () => {} },
		{
			label: 'Delete',
			icon: Trash,
			destructive: true,
			onselect: () => toastStore.show({ message: 'Deleted', tone: 'error' })
		}
	];

	let isSheetOpen = $state(false);
	let isActionSheetOpen = $state(false);
	let isModalOpen = $state(false);
	let isConfirmOpen = $state(false);
	let isPopoverOpen = $state(false);
	let isMenuOpen = $state(false);
	let popoverAnchor = $state<HTMLElement>();
	let menuAnchor = $state<HTMLElement>();

	/** Button does not expose its element, so anchors are found inside a wrapper; focus returns to the button. */
	function buttonIn(wrapper: HTMLElement | undefined) {
		return wrapper?.querySelector('button') ?? undefined;
	}

	function showUndoToast() {
		toastStore.show({
			message: 'Conversation archived',
			action: { label: 'Undo', onaction: () => toastStore.show({ message: 'Restored' }) }
		});
	}
</script>

<GallerySection title="Overlays">
	<Button variant="glass" onclick={() => (isSheetOpen = true)}>Bottom sheet</Button>
	<Button variant="glass" onclick={() => (isActionSheetOpen = true)}>Action sheet</Button>
	<Button variant="glass" onclick={() => (isModalOpen = true)}>Modal</Button>
	<Button variant="glass" onclick={() => (isConfirmOpen = true)}>Confirm</Button>
	<span bind:this={popoverAnchor}>
		<Button variant="glass" onclick={() => (isPopoverOpen = !isPopoverOpen)}>Popover</Button>
	</span>
	<span bind:this={menuAnchor}>
		<Button variant="glass" onclick={() => (isMenuOpen = !isMenuOpen)}>Context menu</Button>
	</span>
</GallerySection>

<GallerySection title="Toasts">
	<Button variant="ghost" onclick={() => toastStore.show({ message: 'Draft saved' })}
		>Neutral</Button
	>
	<Button variant="ghost" onclick={() => toastStore.show({ message: 'Sent', tone: 'success' })}>
		Success
	</Button>
	<Button
		variant="ghost"
		onclick={() => toastStore.show({ message: 'Could not send', tone: 'error' })}
	>
		Error
	</Button>
	<Button variant="ghost" onclick={showUndoToast}>With Undo</Button>
</GallerySection>

<BottomSheet bind:open={isSheetOpen} title="Bottom sheet" snapPoints={[0.5, 0.9]}>
	<p>Drag the header to resize or dismiss. Escape closes it.</p>
</BottomSheet>
<ActionSheet bind:open={isActionSheetOpen} title="Message actions" actions={ACTIONS} />
<Modal bind:open={isModalOpen} title="Modal" description="A centered dialog for short tasks.">
	{#snippet actions()}
		<Button onclick={() => (isModalOpen = false)}>Done</Button>
	{/snippet}
</Modal>
<ConfirmDialog
	bind:open={isConfirmOpen}
	title="Delete forever?"
	message="This cannot be undone."
	confirmLabel="Delete"
	destructive
	onconfirm={() => toastStore.show({ message: 'Deleted', tone: 'error' })}
/>
<Popover bind:open={isPopoverOpen} anchor={buttonIn(popoverAnchor)}>
	<p class="popover-text">A popover holds short, non-modal content.</p>
</Popover>
<ContextMenu
	bind:open={isMenuOpen}
	anchor={buttonIn(menuAnchor)}
	label="Message actions"
	items={ACTIONS}
/>

<style>
	.popover-text {
		margin: 0;
		padding: var(--nm-space-2);
		font-size: var(--nm-text-label);
	}
</style>
