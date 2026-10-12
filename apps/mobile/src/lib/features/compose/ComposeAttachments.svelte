<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import X from '@lucide/svelte/icons/x';
	import Icon from '#components/ui/Icon.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import { FILE_ICONS, fileKind, formatBytes } from '#lib/utils/files.js';
	import type { ComposeAttachment } from './attachments.js';

	const COPY = {
		region: (n: number) => (n === 1 ? '1 attachment' : `${n} attachments`),
		remove: (name: string) => `Remove ${name}`,
		retry: (name: string) => `Retry ${name}`,
		uploading: (name: string) => `Uploading ${name}`
	};

	interface Props {
		items: ComposeAttachment[];
		onremove: (key: string) => void;
		/** Only offered for failed uploads, not for files that are too big. */
		onretry: (key: string) => void;
		canRetry: (key: string) => boolean;
	}

	let { items, onremove, onretry, canRetry }: Props = $props();
</script>

{#if items.length}
	<ul class="files" aria-label={COPY.region(items.length)}>
		{#each items as item (item.key)}
			<li class="file" data-status={item.status}>
				<span class="file__icon">
					<Icon icon={item.status === 'error' ? CircleAlert : FILE_ICONS[fileKind(item)]} />
				</span>
				<span class="file__meta">
					<span class="file__name nm-text-body nm-text-truncate">{item.filename}</span>
					{#if item.status === 'error'}
						<span class="file__error nm-text-caption">{item.error}</span>
					{:else}
						<span class="file__size nm-text-caption">{formatBytes(item.size)}</span>
					{/if}
				</span>
				{#if item.status === 'error' && canRetry(item.key)}
					<IconButton
						icon={RotateCw}
						label={COPY.retry(item.filename)}
						size="sm"
						onclick={() => onretry(item.key)}
					/>
				{/if}
				<IconButton
					icon={X}
					label={COPY.remove(item.filename)}
					size="sm"
					onclick={() => onremove(item.key)}
				/>
				{#if item.status === 'uploading'}
					<span
						class="file__bar"
						role="progressbar"
						aria-label={COPY.uploading(item.filename)}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(item.progress * 100)}
					>
						<span class="file__fill" style:transform="scaleX({item.progress})"></span>
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.files {
		display: flex;
		flex-direction: column;
		gap: var(--nm-space-2);
		margin: 0;
		padding: var(--nm-space-3) var(--nm-space-4);
		list-style: none;
		border-block-end: 1px solid var(--nm-color-border);
	}
	.file {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		padding-inline-start: var(--nm-space-3);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-3);
		overflow: hidden;
	}
	.file[data-status='error'] {
		border-color: var(--nm-color-danger);
	}
	.file__icon {
		display: grid;
		color: var(--nm-color-text-muted);
	}
	.file[data-status='error'] .file__icon,
	.file__error {
		color: var(--nm-color-danger);
	}
	.file__meta {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-inline-size: 0;
		padding-block: var(--nm-space-2);
	}
	.file__name {
		color: var(--nm-color-text);
	}
	.file__size {
		color: var(--nm-color-text-muted);
	}
	.file__bar {
		position: absolute;
		inset-inline: 0;
		inset-block-end: 0;
		block-size: 3px;
		background: var(--nm-color-border);
	}
	.file__fill {
		display: block;
		block-size: 100%;
		background: var(--nm-color-accent);
		transform-origin: left;
		transition: transform var(--nm-duration-fast) linear;
	}
</style>
