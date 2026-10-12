<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { Contact, Label } from '@nem/shared';
	import ActionSheet, { type ActionSheetItem } from '#components/ui/ActionSheet.svelte';
	import Chip from '#components/ui/Chip.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import PersonSheet from './PersonSheet.svelte';
	import {
		DATE_PRESETS,
		activePreset,
		filterClauses,
		presetClause,
		setFilter,
		toggleClause,
		type FilterKind
	} from './filters.js';

	const COPY = {
		group: 'Filters',
		from: 'From',
		to: 'To',
		date: 'Date',
		anyTime: 'Any time',
		attachment: 'Has attachment',
		unread: 'Unread',
		label: 'Label',
		anyLabel: 'Any label'
	};

	interface Props {
		/** The submitted query the chips read and rewrite. */
		query: string;
		labels: readonly Label[];
		searchContacts: (q: string) => Promise<Contact[]>;
		/** Runs the rewritten query. */
		onchange: (query: string) => void;
	}

	let { query, labels, searchContacts, onchange }: Props = $props();

	let personKind = $state<'from' | 'to'>('from');
	let personOpen = $state(false);
	let dateOpen = $state(false);
	let labelOpen = $state(false);

	const value = (kind: FilterKind) => filterClauses(query, kind)[0]?.value;
	const from = $derived(value('from'));
	const to = $derived(value('to'));
	const label = $derived(value('label'));
	const preset = $derived(activePreset(query));
	const hasDate = $derived(filterClauses(query, 'date').length > 0);
	const hasAttachment = $derived(filterClauses(query, 'attachment').length > 0);
	const isUnread = $derived(filterClauses(query, 'unread').length > 0);

	/** How the query names a label: "parent/child" for nested ones, lowercased. */
	function labelPath(l: Label): string {
		const parent = l.parentId ? labels.find((p) => p.id === l.parentId) : undefined;
		return (parent ? `${parent.name}/${l.name}` : l.name).toLowerCase();
	}

	function openPerson(kind: 'from' | 'to') {
		personKind = kind;
		personOpen = true;
	}

	function pickPerson(email: string | null) {
		const clauses = email ? [{ kind: personKind, value: email, negated: false }] : [];
		onchange(setFilter(query, personKind, clauses));
	}

	function toggle(kind: 'attachment' | 'unread', on: boolean) {
		onchange(setFilter(query, kind, on ? [] : [toggleClause(kind)]));
	}

	const dateActions = $derived<ActionSheetItem[]>([
		{
			label: COPY.anyTime,
			icon: hasDate ? undefined : Check,
			onselect: () => onchange(setFilter(query, 'date', []))
		},
		...DATE_PRESETS.map((p) => ({
			label: p.label,
			icon: preset?.id === p.id ? Check : undefined,
			onselect: () => onchange(setFilter(query, 'date', [presetClause(p)]))
		}))
	]);

	const labelActions = $derived<ActionSheetItem[]>([
		{
			label: COPY.anyLabel,
			icon: label ? undefined : Check,
			onselect: () => onchange(setFilter(query, 'label', []))
		},
		...labels.map((l) => {
			const path = labelPath(l);
			return {
				label: l.parentId ? path : l.name,
				icon: label === path ? Check : undefined,
				onselect: () =>
					onchange(setFilter(query, 'label', [{ kind: 'label', value: path, negated: false }]))
			};
		})
	]);
</script>

{#snippet more()}<Icon icon={ChevronDown} size="sm" />{/snippet}

<div class="chips" role="group" aria-label={COPY.group}>
	<Chip selected={!!from} onclick={() => openPerson('from')} leading={more}>
		{from ? `${COPY.from}: ${from}` : COPY.from}
	</Chip>
	<Chip selected={!!to} onclick={() => openPerson('to')} leading={more}>
		{to ? `${COPY.to}: ${to}` : COPY.to}
	</Chip>
	<Chip selected={hasDate} onclick={() => (dateOpen = true)} leading={more}>
		{preset?.label ?? COPY.date}
	</Chip>
	<Chip selected={hasAttachment} onclick={() => toggle('attachment', hasAttachment)}>
		{COPY.attachment}
	</Chip>
	<Chip selected={isUnread} onclick={() => toggle('unread', isUnread)}>{COPY.unread}</Chip>
	{#if labels.length > 0}
		<Chip selected={!!label} onclick={() => (labelOpen = true)} leading={more}>
			{label ? `${COPY.label}: ${label}` : COPY.label}
		</Chip>
	{/if}
</div>

<PersonSheet
	bind:open={personOpen}
	title={personKind === 'from' ? COPY.from : COPY.to}
	current={personKind === 'from' ? from : to}
	{searchContacts}
	onpick={pickPerson}
/>
<ActionSheet bind:open={dateOpen} title={COPY.date} actions={dateActions} />
<ActionSheet bind:open={labelOpen} title={COPY.label} actions={labelActions} />

<style>
	.chips {
		display: flex;
		gap: var(--nm-space-2);
		padding-block: var(--nm-space-1) var(--nm-space-2);
		padding-inline: max(var(--nm-space-3), var(--nm-safe-left))
			max(var(--nm-space-3), var(--nm-safe-right));
		overflow-x: auto;
		scrollbar-width: none;
		overscroll-behavior-x: contain;
	}
	.chips :global(.chip) {
		flex-shrink: 0;
	}
</style>
