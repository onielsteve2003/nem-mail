<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { Contact } from '@nem/shared';
	import type { Snippet } from 'svelte';
	import Avatar from '#components/ui/Avatar.svelte';
	import Chip from '#components/ui/Chip.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import { addRecipients, isSeparatorKey, parseRecipients, type Recipient } from './recipients.js';

	const SEARCH_DEBOUNCE_MS = 150;
	const SUGGESTION_LIMIT = 6;
	const COPY = {
		invalid: 'Not a valid email address',
		invalidMany: (count: number) => `${count} addresses are not valid`,
		remove: (email: string) => `Remove ${email}`,
		contacts: 'Contacts'
	};

	interface Props {
		/** Visible field label: To, Cc or Bcc. */
		label: string;
		recipients?: Recipient[];
		/** Contact autocomplete; a failed lookup just means no suggestions. */
		search: (q: string) => Promise<Contact[]>;
		/** Extra control at the end of the row, e.g. the Cc/Bcc toggle. */
		trailing?: Snippet;
	}

	let { label, recipients = $bindable([]), search, trailing }: Props = $props();

	const id = $props.id();
	let text = $state('');
	let suggestions = $state<Contact[]>([]);
	let active = $state(-1);
	let input: HTMLInputElement;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let request = 0;

	const isOpen = $derived(suggestions.length > 0);
	const highlighted = $derived(suggestions[active]);
	const invalidCount = $derived(recipients.filter((r) => !r.isValid).length);

	function close() {
		clearTimeout(timer);
		request++;
		suggestions = [];
		active = -1;
	}

	function commit(value = text) {
		const added = parseRecipients(value);
		if (added.length) recipients = addRecipients(recipients, added);
		text = '';
		close();
	}

	function pick(contact: Contact) {
		recipients = addRecipients(recipients, [
			{ email: contact.email, name: contact.name, isValid: true }
		]);
		text = '';
		close();
		input.focus();
	}

	function remove(email: string) {
		recipients = recipients.filter((r) => r.email !== email);
		input.focus();
	}

	function lookup() {
		clearTimeout(timer);
		const q = text.trim();
		if (!q) return close();
		const current = ++request;
		timer = setTimeout(async () => {
			const taken = new Set(recipients.map((r) => r.email));
			const found = await search(q).catch(() => [] as Contact[]);
			if (current !== request) return;
			suggestions = found.filter((c) => !taken.has(c.email)).slice(0, SUGGESTION_LIMIT);
			active = suggestions.length ? 0 : -1;
		}, SEARCH_DEBOUNCE_MS);
	}

	function onkeydown(event: KeyboardEvent) {
		if (isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			active = (active + step + suggestions.length) % suggestions.length;
		} else if (isOpen && event.key === 'Escape') {
			// Closes the list only, not compose.
			event.stopPropagation();
			close();
		} else if (event.key === 'Enter' && highlighted) {
			event.preventDefault();
			pick(highlighted);
		} else if (isSeparatorKey(event.key) && text.trim()) {
			event.preventDefault();
			commit();
		} else if (event.key === 'Backspace' && !text && recipients.length) {
			recipients = recipients.slice(0, -1);
		}
	}

	function onpaste(event: ClipboardEvent) {
		const pasted = event.clipboardData?.getData('text') ?? '';
		// A plain word may be the start of a name to autocomplete; lists and addresses become chips at once.
		if (!/[,;\n@]/.test(pasted)) return;
		event.preventDefault();
		commit(text + pasted);
	}

	$effect(() => () => clearTimeout(timer));
</script>

<div class="recipients">
	<label class="recipients__label nm-text-body" for="{id}-input">{label}</label>
	<div class="recipients__chips">
		{#each recipients as recipient (recipient.email)}
			<Chip
				class={recipient.isValid ? undefined : 'recipient--invalid'}
				onremove={() => remove(recipient.email)}
				removeLabel={COPY.remove(recipient.email)}
			>
				{#snippet leading()}
					{#if !recipient.isValid}<Icon icon={CircleAlert} size="sm" label={COPY.invalid} />{/if}
				{/snippet}
				<span title={recipient.name ? recipient.email : undefined}>
					{recipient.name ?? recipient.email}
				</span>
			</Chip>
		{/each}
		<input
			bind:this={input}
			bind:value={text}
			id="{id}-input"
			class="recipients__input"
			type="text"
			inputmode="email"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			role="combobox"
			aria-autocomplete="list"
			aria-expanded={isOpen}
			aria-controls="{id}-list"
			aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
			aria-invalid={invalidCount > 0 ? 'true' : undefined}
			aria-describedby={invalidCount > 0 ? `${id}-error` : undefined}
			oninput={lookup}
			{onkeydown}
			{onpaste}
			onblur={() => commit()}
		/>
	</div>
	{@render trailing?.()}
	{#if invalidCount > 0}
		<p class="recipients__error nm-text-caption" id="{id}-error">
			{invalidCount === 1 ? COPY.invalid : COPY.invalidMany(invalidCount)}
		</p>
	{/if}
	<ul
		class="recipients__list"
		id="{id}-list"
		role="listbox"
		aria-label={COPY.contacts}
		hidden={!isOpen}
	>
		{#each suggestions as contact, index (contact.id)}
			<!-- mousedown keeps focus in the input, so blur does not commit the half-typed text first.
			     Keyboard users pick with the arrow keys and Enter from the input. -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				id="{id}-option-{index}"
				class="recipients__option"
				role="option"
				aria-selected={index === active}
				onmousedown={(event) => event.preventDefault()}
				onclick={() => pick(contact)}
			>
				<Avatar name={contact.name ?? contact.email} size="sm" />
				<span class="recipients__who">
					<span class="recipients__line">{contact.name ?? contact.email}</span>
					{#if contact.name}
						<span class="recipients__line recipients__email nm-text-caption">{contact.email}</span>
					{/if}
				</span>
			</li>
		{/each}
	</ul>
</div>

<style>
	.recipients {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nm-space-2);
		padding: var(--nm-space-1) var(--nm-space-4);
		border-block-end: 1px solid var(--nm-color-border);
	}
	.recipients__label {
		min-inline-size: var(--nm-space-8);
		color: var(--nm-color-text-muted);
	}
	.recipients__chips {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nm-space-1);
		min-inline-size: 0;
	}
	.recipients__input {
		flex: 1;
		min-inline-size: 8rem;
		min-block-size: var(--nm-space-10);
		padding: 0;
		border: none;
		background: transparent;
		color: var(--nm-color-text);
		font: inherit;
		font-size: var(--nm-text-field);
		outline: none;
	}
	.recipients:focus-within {
		box-shadow: inset 0 -2px 0 var(--nm-color-focus);
	}
	.recipients :global(.recipient--invalid) {
		border-color: var(--nm-color-danger);
		color: var(--nm-color-danger);
	}
	.recipients__error {
		flex-basis: 100%;
		margin: 0;
		color: var(--nm-color-danger);
	}
	.recipients__list {
		position: absolute;
		inset-block-start: 100%;
		inset-inline: var(--nm-space-2);
		z-index: 1;
		margin: 0;
		padding: var(--nm-space-1);
		list-style: none;
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-lg);
		background: var(--nm-color-surface-3);
		box-shadow: var(--nm-shadow-3);
	}
	.recipients__list[hidden] {
		display: none;
	}
	.recipients__option {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
		min-block-size: var(--nm-space-10);
		padding: var(--nm-space-2) var(--nm-space-3);
		border-radius: var(--nm-radius-md);
		cursor: pointer;
	}
	.recipients__option[aria-selected='true'] {
		background: var(--nm-color-accent-soft);
	}
	.recipients__who {
		display: grid;
		min-inline-size: 0;
	}
	.recipients__line {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.recipients__email {
		color: var(--nm-color-text-muted);
	}
</style>
