<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Users from '@lucide/svelte/icons/users';
	import type { Contact } from '@nem/shared';
	import { untrack } from 'svelte';
	import Avatar from '#components/ui/Avatar.svelte';
	import BottomSheet from '#components/ui/BottomSheet.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import SearchField from '#components/ui/SearchField.svelte';

	const SEARCH_DEBOUNCE_MS = 150;
	const COPY = {
		find: 'Find a person',
		anyone: 'Anyone',
		use: (q: string) => `Use "${q}"`,
		none: 'No people match'
	};

	interface Props {
		open?: boolean;
		/** "From" or "To". */
		title: string;
		/** The address the chip holds now, if any. */
		current?: string;
		searchContacts: (q: string) => Promise<Contact[]>;
		/** The chosen address, or null for Anyone. */
		onpick: (value: string | null) => void;
	}

	let { open = $bindable(false), title, current, searchContacts, onpick }: Props = $props();

	let text = $state('');
	let contacts = $state<Contact[]>([]);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let request = 0;

	const typed = $derived(text.trim().toLowerCase());

	// Each open starts empty, showing frequent contacts.
	$effect.pre(() => {
		if (!open) return;
		untrack(() => {
			text = '';
			lookup(0);
		});
		return () => clearTimeout(timer);
	});

	function lookup(delay = SEARCH_DEBOUNCE_MS) {
		clearTimeout(timer);
		const current = ++request;
		const q = typed;
		timer = setTimeout(async () => {
			const found = await searchContacts(q).catch(() => [] as Contact[]);
			if (current === request) contacts = found;
		}, delay);
	}

	function pick(value: string | null) {
		open = false;
		onpick(value);
	}
</script>

<BottomSheet bind:open {title} snapPoints={[0.7, 0.92]}>
	<form
		class="find"
		onsubmit={(event) => {
			event.preventDefault();
			if (typed) pick(typed);
		}}
	>
		<SearchField
			label={COPY.find}
			bind:value={text}
			autocomplete="off"
			data-autofocus
			oninput={() => lookup()}
			onclear={() => lookup(0)}
		/>
	</form>
	<ul class="list">
		{#if typed}
			{#if !contacts.some((c) => c.email === typed)}
				<li>
					<button type="button" class="row" onclick={() => pick(typed)}>
						<span class="row__text">{COPY.use(typed)}</span>
					</button>
				</li>
			{/if}
		{:else}
			<li>
				<button type="button" class="row" aria-pressed={!current} onclick={() => pick(null)}>
					<span class="row__icon"><Icon icon={Users} /></span>
					<span class="row__text">{COPY.anyone}</span>
					{#if !current}<Icon icon={Check} />{/if}
				</button>
			</li>
		{/if}
		{#each contacts as contact (contact.email)}
			{@const chosen = contact.email === current}
			<li>
				<button type="button" class="row" aria-pressed={chosen} onclick={() => pick(contact.email)}>
					<Avatar name={contact.name ?? contact.email} size="sm" />
					<span class="row__text">
						<span>{contact.name ?? contact.email}</span>
						{#if contact.name}<span class="row__sub">{contact.email}</span>{/if}
					</span>
					{#if chosen}<Icon icon={Check} />{/if}
				</button>
			</li>
		{/each}
	</ul>
</BottomSheet>

<style>
	.find {
		padding-block-end: var(--nm-space-2);
	}
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
		inline-size: 100%;
		min-block-size: var(--nm-size-touch);
		padding: var(--nm-space-2) var(--nm-space-3);
		border: 0;
		border-radius: var(--nm-radius-md);
		background: none;
		color: var(--nm-color-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.row:hover {
		background: var(--nm-color-surface-2);
	}
	.row__icon {
		display: inline-grid;
		place-items: center;
		inline-size: var(--nm-size-avatar-sm);
		color: var(--nm-color-text-muted);
	}
	.row__text {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-inline-size: 0;
		overflow-wrap: anywhere;
	}
	.row__sub {
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-caption);
	}
</style>
