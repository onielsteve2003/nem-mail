<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Avatar from '#components/ui/Avatar.svelte';
	import Badge from '#components/ui/Badge.svelte';
	import Button from '#components/ui/Button.svelte';
	import Divider from '#components/ui/Divider.svelte';
	import EmptyState from '#components/ui/EmptyState.svelte';
	import ErrorState from '#components/ui/ErrorState.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import ListItem from '#components/ui/ListItem.svelte';
	import OfflineBanner from '#components/ui/OfflineBanner.svelte';
	import ProgressBar from '#components/ui/ProgressBar.svelte';
	import Skeleton from '#components/ui/Skeleton.svelte';
	import Spinner from '#components/ui/Spinner.svelte';
	import GallerySection from './GallerySection.svelte';

	const OFFLINE_NOTE = 'The offline banner below shows only while the device is offline.';

	let isRetrying = $state(false);

	function retry() {
		isRetrying = true;
		setTimeout(() => (isRetrying = false), 1500);
	}
</script>

<GallerySection title="Lists">
	<div class="gallery-block">
		<ListItem title="Inbox" href="/dev/gallery" current>
			{#snippet leading()}<Icon icon={Inbox} />{/snippet}
			{#snippet trailing()}<Badge count={12} label="12 unread" />{/snippet}
		</ListItem>
		<ListItem title="Ada Lovelace" subtitle="Notes on the analytical engine" onclick={() => {}}>
			{#snippet leading()}<Avatar name="Ada Lovelace" />{/snippet}
			{#snippet trailing()}<Icon icon={ChevronRight} />{/snippet}
		</ListItem>
		<Divider inset="start" />
		<ListItem title="Disabled row" subtitle="Cannot be opened" disabled onclick={() => {}} />
	</div>
	<span>Left</span>
	<Divider orientation="vertical" />
	<span>Right</span>
</GallerySection>

<GallerySection title="Loading">
	<Spinner size="sm" />
	<Spinner />
	<Spinner size="lg" label="Loading mail" />
	<div class="gallery-block"><ProgressBar value={0.6} label="Downloading model" showLabel /></div>
	<div class="gallery-block"><ProgressBar label="Syncing" /></div>
	<div class="gallery-block skeleton-row">
		<Skeleton shape="circle" width="var(--nm-size-avatar-md)" height="var(--nm-size-avatar-md)" />
		<Skeleton lines={2} />
	</div>
</GallerySection>

<GallerySection title="States">
	<div class="gallery-block">
		<EmptyState title="Inbox zero" message="Nothing left to triage." illustration="done">
			{#snippet action()}<Button variant="ghost">Refresh</Button>{/snippet}
		</EmptyState>
	</div>
	<div class="gallery-block">
		<ErrorState message="We could not load your mail." onretry={retry} retrying={isRetrying} />
	</div>
	<p class="gallery-block note">{OFFLINE_NOTE}</p>
	<div class="gallery-block"><OfflineBanner /></div>
</GallerySection>

<style>
	.skeleton-row {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
	}
	.skeleton-row > :global(:last-child) {
		flex: 1;
	}
	.note {
		margin: 0;
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-label);
	}
</style>
