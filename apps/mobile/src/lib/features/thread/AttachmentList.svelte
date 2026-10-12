<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import type { Attachment } from '@nem/shared';
	import Button from '#components/ui/Button.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import Modal from '#components/ui/Modal.svelte';
	import { toastStore } from '#lib/stores/toast.svelte.js';
	import { downloadBlob } from '#lib/utils/files.js';
	import AttachmentTile from './AttachmentTile.svelte';

	const HEADING = (count: number) => `${count} attachment${count === 1 ? '' : 's'}`;
	const DOWNLOAD = 'Download';
	const DOWNLOAD_FAILED = (name: string) => `Couldn't download ${name}`;
	const RETRY = 'Retry';

	interface Props {
		attachments: Attachment[];
		load: (id: string) => Promise<Blob>;
	}

	let { attachments, load }: Props = $props();

	let preview = $state<{ attachment: Attachment; url: string } | null>(null);
	let previewOpen = $state(false);
	let downloading = $state<string | null>(null);

	function openPreview(attachment: Attachment, url: string): void {
		preview = { attachment, url };
		previewOpen = true;
	}

	async function download(attachment: Attachment): Promise<void> {
		if (downloading) return;
		downloading = attachment.id;
		try {
			downloadBlob(await load(attachment.id), attachment.filename);
		} catch {
			toastStore.show({
				message: DOWNLOAD_FAILED(attachment.filename),
				tone: 'error',
				action: { label: RETRY, onaction: () => void download(attachment) }
			});
		} finally {
			downloading = null;
		}
	}
</script>

<section class="files" aria-label={HEADING(attachments.length)}>
	<h3 class="files__heading nm-text-label">{HEADING(attachments.length)}</h3>
	<ul class="files__list">
		{#each attachments as attachment (attachment.id)}
			<li>
				<AttachmentTile
					{attachment}
					{load}
					disabled={downloading === attachment.id}
					onpreview={openPreview}
					ondownload={(file) => void download(file)}
				/>
			</li>
		{/each}
	</ul>
</section>

{#if preview}
	<Modal bind:open={previewOpen} title={preview.attachment.filename} class="files__modal">
		<img class="files__image" src={preview.url} alt={preview.attachment.filename} />
		{#snippet actions()}
			<Button
				variant="primary"
				loading={downloading === preview?.attachment.id}
				onclick={() => preview && void download(preview.attachment)}
			>
				{#snippet leading()}<Icon icon={Download} />{/snippet}
				{DOWNLOAD}
			</Button>
		{/snippet}
	</Modal>
{/if}

<style>
	.files {
		display: flex;
		flex-direction: column;
		gap: var(--nm-space-2);
		padding: 0 var(--nm-space-4) var(--nm-space-5);
	}
	.files__heading {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
	.files__list {
		display: flex;
		gap: var(--nm-space-3);
		margin: 0;
		padding: 0;
		overflow-x: auto;
		list-style: none;
		scroll-snap-type: x proximity;
	}
	.files__list li {
		scroll-snap-align: start;
	}
	/* Beats the Modal's own width; photos need more room than a dialog. */
	:global(.layer > .modal.files__modal) {
		inline-size: min(100%, 40rem);
	}
	.files__image {
		display: block;
		max-inline-size: 100%;
		max-block-size: 60vh;
		margin-inline: auto;
		border-radius: var(--nm-radius-md);
		object-fit: contain;
	}
</style>
