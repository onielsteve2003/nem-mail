<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { LABEL_COLORS, LABEL_NAME_MAX, type Label, type LabelColor } from '@nem/shared';
	import BottomSheet from '#components/ui/BottomSheet.svelte';
	import Button from '#components/ui/Button.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import { LABEL_COLOR_NAMES, LABEL_DOT } from '#components/ui/label-colors.js';
	import TextField from '#components/ui/TextField.svelte';
	import { labelProblem, parentChoices } from './labels.js';

	const COPY = {
		create: 'New label',
		edit: 'Edit label',
		name: 'Name',
		color: 'Color',
		parent: 'Nest under',
		topLevel: 'Nothing (top level)',
		hasChildren: 'Labels with nested labels stay at the top level.',
		save: 'Save',
		create_: 'Create',
		delete: 'Delete label'
	};

	interface Props {
		open?: boolean;
		/** The label being edited, or null to create one. */
		label: Label | null;
		labels: Label[];
		/** True while the save or delete request runs. */
		busy?: boolean;
		/** An error from the server, shown under the name. */
		serverError?: string;
		onsave: (fields: { name: string; color: LabelColor; parentId: string | null }) => void;
		ondelete: (label: Label) => void;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		label,
		labels,
		busy = false,
		serverError = '',
		onsave,
		ondelete,
		onclose
	}: Props = $props();

	const id = $props.id();
	let name = $state('');
	let color = $state<LabelColor>('neutral');
	let parentId = $state<string | null>(null);
	let touched = $state(false);

	// Each open starts from the label (or blank for a new one).
	$effect.pre(() => {
		if (!open) return;
		name = label?.name ?? '';
		color = label?.color ?? 'neutral';
		parentId = label?.parentId ?? null;
		touched = false;
	});

	const editingId = $derived(label?.id ?? null);
	const parents = $derived(parentChoices(labels, editingId));
	const hasChildren = $derived(!!editingId && labels.some((l) => l.parentId === editingId));
	const problem = $derived(labelProblem({ name, parentId }, labels, editingId));
	const error = $derived((touched && problem) || serverError || undefined);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		touched = true;
		if (problem || busy) return;
		onsave({ name: name.trim(), color, parentId });
	}
</script>

<BottomSheet bind:open title={label ? COPY.edit : COPY.create} {onclose}>
	<form class="editor" onsubmit={submit} novalidate>
		<TextField
			label={COPY.name}
			bind:value={name}
			maxlength={LABEL_NAME_MAX + 10}
			autocomplete="off"
			data-autofocus
			{error}
			oninput={() => (touched = true)}
		/>

		<fieldset class="editor__colors">
			<legend class="editor__legend nm-text-caption">{COPY.color}</legend>
			{#each LABEL_COLORS as option (option)}
				<label class="swatch">
					<input
						class="nm-visually-hidden"
						type="radio"
						name="{id}-color"
						value={option}
						bind:group={color}
					/>
					<span class="swatch__dot" style:background={LABEL_DOT[option]} aria-hidden="true">
						{#if color === option}<Icon icon={Check} size="sm" />{/if}
					</span>
					<span class="swatch__name nm-text-caption">{LABEL_COLOR_NAMES[option]}</span>
				</label>
			{/each}
		</fieldset>

		<div class="editor__parent">
			<label class="editor__legend nm-text-caption" for="{id}-parent">{COPY.parent}</label>
			<select
				id="{id}-parent"
				class="editor__select nm-text-body"
				bind:value={parentId}
				disabled={hasChildren}
				aria-describedby={hasChildren ? `${id}-parent-hint` : undefined}
			>
				<option value={null}>{COPY.topLevel}</option>
				{#each parents as parent (parent.id)}
					<option value={parent.id}>{parent.name}</option>
				{/each}
			</select>
			{#if hasChildren}
				<p id="{id}-parent-hint" class="editor__hint nm-text-caption">{COPY.hasChildren}</p>
			{/if}
		</div>

		<div class="editor__actions">
			{#if label}
				<Button variant="ghost" disabled={busy} onclick={() => ondelete(label)}>
					{#snippet leading()}<Icon icon={Trash2} size="sm" />{/snippet}
					{COPY.delete}
				</Button>
			{/if}
			<Button type="submit" loading={busy} class="editor__save">
				{label ? COPY.save : COPY.create_}
			</Button>
		</div>
	</form>
</BottomSheet>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: var(--nm-space-5);
		padding-block-end: var(--nm-space-2);
	}
	.editor__colors {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nm-space-2);
		margin: 0;
		padding: 0;
		border: none;
	}
	.editor__legend {
		display: block;
		margin-block-end: var(--nm-space-2);
		padding: 0;
		color: var(--nm-color-text-muted);
	}
	.swatch {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--nm-space-1);
		min-inline-size: var(--nm-size-touch);
		cursor: pointer;
	}
	.swatch__dot {
		display: grid;
		place-items: center;
		inline-size: var(--nm-size-control-sm);
		block-size: var(--nm-size-control-sm);
		border-radius: var(--nm-radius-pill);
		color: var(--nm-color-on-aurora);
		box-shadow: inset 0 0 0 1px var(--nm-color-border);
	}
	.swatch input:checked + .swatch__dot {
		box-shadow:
			0 0 0 2px var(--nm-color-surface-2),
			0 0 0 4px var(--nm-color-text);
	}
	.swatch input:focus-visible + .swatch__dot {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: 4px;
	}
	.swatch__name {
		color: var(--nm-color-text-muted);
	}
	.editor__select {
		inline-size: 100%;
		min-block-size: var(--nm-size-control-md);
		padding-inline: var(--nm-space-3);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-1);
		color: var(--nm-color-text);
		font-family: inherit;
		font-size: var(--nm-text-field);
	}
	.editor__select:focus-visible {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: 2px;
	}
	.editor__select:disabled {
		color: var(--nm-color-text-subtle);
	}
	.editor__hint {
		margin: var(--nm-space-1) 0 0;
		color: var(--nm-color-text-muted);
	}
	.editor__actions {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
	}
	.editor__actions :global(.editor__save) {
		margin-inline-start: auto;
	}
</style>
