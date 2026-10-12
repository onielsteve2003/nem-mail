<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { LABEL_NAME_MAX, type Label, type ThreadOp, type ThreadSummary } from '@nem/shared';
	import { untrack } from 'svelte';
	import { errorMessage } from '#lib/utils/errors.js';
	import {
		filterLabels,
		labelChangeOps,
		labelStates,
		type LabelState
	} from '#lib/utils/thread-actions.js';
	import BottomSheet from './BottomSheet.svelte';
	import Button from './Button.svelte';
	import Checkbox from './Checkbox.svelte';
	import { LABEL_DOT } from './label-colors.js';
	import TextField from './TextField.svelte';

	const COPY = {
		title: 'Labels',
		search: 'Find or create a label',
		create: (name: string) => `Create "${name}"`,
		none: 'No labels match',
		noLabels: 'No labels yet. Type a name to create one.',
		tooLong: `Use ${LABEL_NAME_MAX} characters or fewer`,
		createFailed: "Couldn't create the label",
		apply: 'Apply',
		cancel: 'Cancel'
	};

	interface Props {
		open?: boolean;
		/** The threads being labeled; checkboxes start from their labels. */
		threads: readonly ThreadSummary[];
		labels: readonly Label[];
		/** Creates a top-level label by name. Leave out to hide inline create. */
		oncreate?: (name: string) => Promise<Label>;
		/** The add/remove ops for the changes, or nothing when unchanged. */
		onapply: (ops: ThreadOp[]) => void;
		onclose?: () => void;
	}

	let { open = $bindable(false), threads, labels, oncreate, onapply, onclose }: Props = $props();

	let query = $state('');
	let initial = $state<Record<string, LabelState>>({});
	let chosen = $state<Record<string, LabelState>>({});
	let creating = $state(false);
	let createError = $state('');

	// Each open starts from the threads' labels as they are now.
	$effect.pre(() => {
		if (!open) return;
		untrack(() => {
			initial = labelStates(
				threads,
				labels.map((label) => label.id)
			);
			chosen = { ...initial };
			query = '';
			createError = '';
		});
	});

	const shown = $derived(filterLabels(labels, query));
	const name = $derived(query.trim());
	const canCreate = $derived(
		!!oncreate &&
			name.length > 0 &&
			!labels.some((l) => l.parentId === null && l.name.toLowerCase() === name.toLowerCase())
	);
	const nameError = $derived(name.length > LABEL_NAME_MAX ? COPY.tooLong : createError);

	function toggle(id: string): void {
		chosen[id] = chosen[id] === 'all' ? 'none' : 'all';
	}

	async function create(): Promise<void> {
		if (!oncreate || !canCreate || nameError) return;
		creating = true;
		createError = '';
		try {
			const label = await oncreate(name);
			// New labels start unchecked on the threads and checked in the picker.
			initial[label.id] = 'none';
			chosen[label.id] = 'all';
			query = '';
		} catch (error) {
			createError = errorMessage(error, COPY.createFailed);
		} finally {
			creating = false;
		}
	}

	function close(): void {
		open = false;
		onclose?.();
	}

	function apply(): void {
		const ops = labelChangeOps(initial, chosen);
		close();
		if (ops.length > 0) onapply(ops);
	}
</script>

<BottomSheet bind:open title={COPY.title} {onclose} snapPoints={[0.7, 0.92]}>
	<form
		class="find"
		onsubmit={(event) => {
			event.preventDefault();
			void create();
		}}
	>
		<TextField
			label={COPY.search}
			bind:value={query}
			error={nameError}
			autocomplete="off"
			data-autofocus
			oninput={() => (createError = '')}
		/>
		{#if canCreate}
			<Button type="submit" variant="glass" loading={creating} disabled={!!nameError}>
				{#snippet leading()}<Plus aria-hidden="true" size={18} />{/snippet}
				{COPY.create(name)}
			</Button>
		{/if}
	</form>

	{#if shown.length > 0}
		<ul class="labels">
			{#each shown as label (label.id)}
				<li class={['labels__row', { 'labels__row--child': label.parentId !== null }]}>
					<span class="labels__dot" style:background={LABEL_DOT[label.color]} aria-hidden="true"
					></span>
					<Checkbox
						label={label.name}
						checked={chosen[label.id] === 'all'}
						indeterminate={chosen[label.id] === 'some'}
						onchange={() => toggle(label.id)}
					/>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty nm-text-body">{labels.length === 0 ? COPY.noLabels : COPY.none}</p>
	{/if}

	<div class="actions">
		<Button variant="ghost" onclick={close}>{COPY.cancel}</Button>
		<Button onclick={apply}>{COPY.apply}</Button>
	</div>
</BottomSheet>

<style>
	.find {
		display: flex;
		flex-direction: column;
		gap: var(--nm-space-2);
		padding-block-end: var(--nm-space-2);
	}
	.labels {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.labels__row {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
	}
	.labels__row--child {
		padding-inline-start: var(--nm-space-6);
	}
	.labels__dot {
		flex-shrink: 0;
		inline-size: var(--nm-space-3);
		block-size: var(--nm-space-3);
		border-radius: var(--nm-radius-round);
	}
	.labels__row :global(.check) {
		flex: 1;
	}
	.empty {
		margin: 0;
		padding-block: var(--nm-space-4);
		color: var(--nm-color-text-muted);
	}
	.actions {
		position: sticky;
		inset-block-end: 0;
		display: flex;
		justify-content: flex-end;
		gap: var(--nm-space-2);
		padding-block: var(--nm-space-3);
		background: var(--nm-color-surface-2);
	}
</style>
