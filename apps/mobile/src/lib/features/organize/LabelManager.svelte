<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Plus from '@lucide/svelte/icons/plus';
	import Tag from '@lucide/svelte/icons/tag';
	import type { Label, LabelColor } from '@nem/shared';
	import { labelTree } from '#components/layout/nav.js';
	import Button from '#components/ui/Button.svelte';
	import ConfirmDialog from '#components/ui/ConfirmDialog.svelte';
	import EmptyState from '#components/ui/EmptyState.svelte';
	import ErrorState from '#components/ui/ErrorState.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import { LABEL_COLOR_NAMES, LABEL_DOT } from '#components/ui/label-colors.js';
	import ListItem from '#components/ui/ListItem.svelte';
	import Skeleton from '#components/ui/Skeleton.svelte';
	import { getRepositories } from '#lib/data/provider.js';
	import { getMailboxStore } from '#lib/stores/mailbox.svelte.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { toastStore } from '#lib/stores/toast.svelte.js';
	import { getUiStore } from '#lib/stores/ui.svelte.js';
	import { errorMessage } from '#lib/utils/errors.js';
	import LabelEditor from './LabelEditor.svelte';

	const COPY = {
		add: 'New label',
		loading: 'Loading labels',
		loadError: "Couldn't load your labels",
		emptyTitle: 'No labels yet',
		emptyMessage: 'Labels sort mail your way. A thread can have several.',
		nestedIn: (parent: string) => `In ${parent}`,
		created: (name: string) => `Label "${name}" created`,
		saved: 'Label saved',
		deleted: (name: string) => `Label "${name}" deleted`,
		deleteTitle: (name: string) => `Delete "${name}"?`,
		deleteMessage: 'Mail keeps its other labels and stays where it is.',
		deleteNested:
			'Mail keeps its other labels and stays where it is. Nested labels move to the top.',
		deleteConfirm: 'Delete',
		deleteFailed: "Couldn't delete the label",
		saveFailed: "Couldn't save the label"
	};

	const repos = getRepositories();
	const session = getSessionStore();
	const mailbox = getMailboxStore();
	const ui = getUiStore();

	let labels = $state<Label[]>([]);
	let status = $state<'loading' | 'error' | 'ready'>('loading');
	let loadError = $state<unknown>(null);
	const tree = $derived(labelTree(labels));
	const names = $derived(Object.fromEntries(labels.map((l) => [l.id, l.name])));

	let isEditorOpen = $state(false);
	let editing = $state<Label | null>(null);
	let busy = $state(false);
	let serverError = $state('');
	let deleting = $state<Label | null>(null);
	let isDeleteOpen = $state(false);

	async function load(): Promise<void> {
		status = 'loading';
		try {
			labels = await repos.labels.list();
			status = 'ready';
		} catch (error) {
			loadError = error;
			status = 'error';
		}
	}

	$effect(() => {
		if (session.user) void load();
	});

	function open(label: Label | null): void {
		editing = label;
		serverError = '';
		isEditorOpen = true;
	}

	/** Lists, the drawer and threads read labels; tell them something changed. */
	function changed(): void {
		ui.labelsChanged();
		mailbox.invalidate();
	}

	async function save(fields: { name: string; color: LabelColor; parentId: string | null }) {
		busy = true;
		serverError = '';
		try {
			if (editing) {
				const updated = await repos.labels.update(editing.id, fields);
				labels = labels.map((l) => (l.id === updated.id ? updated : l));
				toastStore.show({ message: COPY.saved, tone: 'success' });
			} else {
				const created = await repos.labels.create(fields);
				labels = [...labels, created];
				toastStore.show({ message: COPY.created(created.name), tone: 'success' });
			}
			isEditorOpen = false;
			changed();
		} catch (error) {
			// Validation and name clashes belong next to the field; the sheet stays open.
			serverError = errorMessage(error, COPY.saveFailed);
		} finally {
			busy = false;
		}
	}

	function askDelete(label: Label): void {
		isEditorOpen = false;
		deleting = label;
		isDeleteOpen = true;
	}

	async function remove(): Promise<void> {
		const label = deleting;
		if (!label) return;
		try {
			await repos.labels.remove(label.id);
			labels = labels
				.filter((l) => l.id !== label.id)
				.map((l) => (l.parentId === label.id ? { ...l, parentId: null } : l));
			toastStore.show({ message: COPY.deleted(label.name) });
			changed();
		} catch (error) {
			toastStore.show({ message: errorMessage(error, COPY.deleteFailed), tone: 'error' });
		}
	}

	const hasChildren = (label: Label | null) =>
		!!label && labels.some((l) => l.parentId === label.id);
</script>

<div class="manager">
	<div class="manager__bar">
		<Button onclick={() => open(null)} disabled={status !== 'ready'}>
			{#snippet leading()}<Icon icon={Plus} size="sm" />{/snippet}
			{COPY.add}
		</Button>
	</div>

	{#if status === 'loading'}
		<div class="manager__skeleton" role="status" aria-label={COPY.loading}>
			{#each { length: 5 }, index (index)}
				<Skeleton width="60%" />
			{/each}
		</div>
	{:else if status === 'error'}
		<ErrorState title={COPY.loadError} message={errorMessage(loadError)} onretry={load} />
	{:else if tree.length === 0}
		<EmptyState title={COPY.emptyTitle} message={COPY.emptyMessage} illustration="folder" />
	{:else}
		<ul class="manager__list">
			{#each tree as { label, depth } (label.id)}
				<li class:nested={depth === 1}>
					<ListItem
						title={label.name}
						subtitle={label.parentId
							? `${COPY.nestedIn(names[label.parentId] ?? '')} · ${LABEL_COLOR_NAMES[label.color]}`
							: LABEL_COLOR_NAMES[label.color]}
						onclick={() => open(label)}
					>
						{#snippet leading()}
							<span class="dot" style:color={LABEL_DOT[label.color]}><Icon icon={Tag} /></span>
						{/snippet}
						{#snippet trailing()}<Icon icon={ChevronRight} size="sm" />{/snippet}
					</ListItem>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<LabelEditor
	bind:open={isEditorOpen}
	label={editing}
	{labels}
	{busy}
	{serverError}
	onsave={save}
	ondelete={askDelete}
/>
<ConfirmDialog
	bind:open={isDeleteOpen}
	title={COPY.deleteTitle(deleting?.name ?? '')}
	message={hasChildren(deleting) ? COPY.deleteNested : COPY.deleteMessage}
	confirmLabel={COPY.deleteConfirm}
	destructive
	onconfirm={remove}
/>

<style>
	.manager {
		display: flex;
		flex-direction: column;
		gap: var(--nm-space-3);
	}
	.manager__bar {
		display: flex;
		justify-content: flex-end;
		padding-inline: var(--nm-space-4);
	}
	.manager__skeleton {
		display: flex;
		flex-direction: column;
		gap: var(--nm-space-5);
		padding: var(--nm-space-4);
	}
	.manager__list {
		margin: 0;
		padding: 0 var(--nm-space-2);
		list-style: none;
	}
	.nested {
		padding-inline-start: var(--nm-space-6);
	}
	.dot {
		display: inline-flex;
	}
</style>
