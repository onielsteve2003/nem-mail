<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import File from '@lucide/svelte/icons/file';
	import FileArchive from '@lucide/svelte/icons/file-archive';
	import FileImage from '@lucide/svelte/icons/file-image';
	import FileMusic from '@lucide/svelte/icons/file-music';
	import FilePlay from '@lucide/svelte/icons/file-play';
	import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
	import FileText from '@lucide/svelte/icons/file-text';
	import Presentation from '@lucide/svelte/icons/presentation';
	import type { LucideIcon } from '@lucide/svelte';
	import type { Attachment } from '@nem/shared';
	import Icon from '#components/ui/Icon.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import { fileKind, formatBytes, type FileKind } from './attachments.js';

	const OPEN = (name: string) => `Preview ${name}`;
	const SAVE = (name: string) => `Download ${name}`;

	const ICONS: Record<FileKind, LucideIcon> = {
		image: FileImage,
		pdf: FileText,
		doc: FileText,
		sheet: FileSpreadsheet,
		slides: Presentation,
		archive: FileArchive,
		audio: FileMusic,
		video: FilePlay,
		other: File
	};

	interface Props {
		attachment: Attachment;
		/** Fetches the bytes; images use it for the thumbnail. */
		load: (id: string) => Promise<Blob>;
		/** Images open the preview with their loaded URL. */
		onpreview: (attachment: Attachment, url: string) => void;
		ondownload: (attachment: Attachment) => void;
		disabled?: boolean;
	}

	let { attachment, load, onpreview, ondownload, disabled = false }: Props = $props();

	const kind = $derived(fileKind(attachment));
	let thumbnail = $state<string | null>(null);

	$effect(() => {
		if (kind !== 'image') return;
		let url: string | null = null;
		let isCurrent = true;
		load(attachment.id).then(
			(blob) => {
				if (!isCurrent) return;
				url = URL.createObjectURL(blob);
				thumbnail = url;
			},
			// The tile keeps its file icon; Download still reports the failure.
			() => {}
		);
		return () => {
			isCurrent = false;
			thumbnail = null;
			if (url) URL.revokeObjectURL(url);
		};
	});

	function open(): void {
		if (thumbnail) onpreview(attachment, thumbnail);
		else ondownload(attachment);
	}
</script>

<div class="tile">
	<button
		type="button"
		class="tile__open"
		aria-label={thumbnail ? OPEN(attachment.filename) : SAVE(attachment.filename)}
		{disabled}
		onclick={open}
	>
		<span class="tile__preview">
			{#if thumbnail}
				<img src={thumbnail} alt="" loading="lazy" />
			{:else}
				<Icon icon={ICONS[kind]} size="lg" />
			{/if}
		</span>
		<span class="tile__meta">
			<span class="tile__name nm-text-caption nm-text-truncate">{attachment.filename}</span>
			<span class="tile__size nm-text-caption">{formatBytes(attachment.size)}</span>
		</span>
	</button>
	<IconButton
		class="tile__save"
		icon={Download}
		label={SAVE(attachment.filename)}
		size="sm"
		{disabled}
		onclick={() => ondownload(attachment)}
	/>
</div>

<style>
	.tile {
		position: relative;
		flex: none;
		inline-size: 10rem;
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-2);
		overflow: hidden;
	}
	.tile__open {
		display: flex;
		flex-direction: column;
		inline-size: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.tile__open:disabled {
		cursor: default;
	}
	.tile__preview {
		display: grid;
		place-items: center;
		aspect-ratio: 4 / 3;
		background: var(--nm-color-surface-3);
		color: var(--nm-color-text-muted);
	}
	.tile__preview img {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
	}
	.tile__meta {
		display: flex;
		flex-direction: column;
		min-inline-size: 0;
		/* Leaves room for the download button. */
		padding: var(--nm-space-2) var(--nm-size-touch) var(--nm-space-2) var(--nm-space-3);
	}
	.tile__name {
		color: var(--nm-color-text);
		font-weight: var(--nm-weight-medium);
	}
	.tile__size {
		color: var(--nm-color-text-muted);
	}
	.tile :global(.tile__save) {
		position: absolute;
		inset-block-end: 0;
		inset-inline-end: 0;
	}
</style>
