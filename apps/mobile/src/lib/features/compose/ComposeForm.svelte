<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Send from '@lucide/svelte/icons/send';
	import X from '@lucide/svelte/icons/x';
	import Button from '#components/ui/Button.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import { getRepositories } from '#lib/data/provider.js';
	import type { ComposeRequest } from '#lib/stores/ui.svelte.js';
	import { initialBody } from './body.js';
	import BodyEditor from './BodyEditor.svelte';
	import { composeTitle } from './compose.js';
	import RecipientField from './RecipientField.svelte';
	import type { Recipient } from './recipients.js';

	const COPY = {
		close: 'Close compose',
		send: 'Send',
		to: 'To',
		cc: 'Cc',
		bcc: 'Bcc',
		showCcBcc: 'Show Cc and Bcc',
		subject: 'Subject'
	};

	interface Props {
		request: ComposeRequest | null;
		/** Labels the dialog. */
		titleId: string;
		onclose: () => void;
	}

	let { request, titleId, onclose }: Props = $props();

	const repos = getRepositories();
	const id = $props.id();
	const title = $derived(composeTitle(request));

	let to = $state<Recipient[]>([]);
	let cc = $state<Recipient[]>([]);
	let bcc = $state<Recipient[]>([]);
	let showCcBcc = $state(false);
	let subject = $state('');
	let bodyHtml = $state('');

	// The signature goes in once settings load, unless the user has already started typing (FR-5.8).
	$effect(() => {
		if (request?.draftId) return;
		repos.settings
			.get()
			.then((settings) => {
				if (!bodyHtml) bodyHtml = initialBody(settings.signature);
			})
			// No signature is better than a broken compose; the user can still write.
			.catch(() => {});
	});

	const search = (q: string) => repos.contacts.search({ q, limit: 8 });
</script>

<header class="form__head">
	<IconButton icon={X} label={COPY.close} onclick={onclose} />
	<h2 id={titleId} class="form__title nm-text-title-3">{title}</h2>
	<!-- Enabled once sending exists (T7.7). -->
	<Button size="sm" disabled>
		{#snippet leading()}<Icon icon={Send} size="sm" />{/snippet}
		{COPY.send}
	</Button>
</header>
<div class="form__body">
	<RecipientField label={COPY.to} bind:recipients={to} {search}>
		{#snippet trailing()}
			{#if !showCcBcc}
				<IconButton
					icon={ChevronDown}
					label={COPY.showCcBcc}
					size="sm"
					onclick={() => (showCcBcc = true)}
				/>
			{/if}
		{/snippet}
	</RecipientField>
	{#if showCcBcc}
		<RecipientField label={COPY.cc} bind:recipients={cc} {search} />
		<RecipientField label={COPY.bcc} bind:recipients={bcc} {search} />
	{/if}
	<div class="form__subject">
		<label class="form__label nm-text-body" for="{id}-subject">{COPY.subject}</label>
		<input
			bind:value={subject}
			id="{id}-subject"
			class="form__input nm-text-body"
			type="text"
			autocomplete="off"
			maxlength="998"
		/>
	</div>
	<BodyEditor bind:value={bodyHtml} />
</div>

<style>
	.form__head {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		padding: var(--nm-space-2) var(--nm-space-3);
		border-block-end: 1px solid var(--nm-color-border);
	}
	.form__title {
		flex: 1;
		margin: 0;
		min-inline-size: 0;
	}
	.form__body {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-block-size: 0;
		overflow-y: auto;
	}
	.form__subject {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		padding: var(--nm-space-1) var(--nm-space-4);
		border-block-end: 1px solid var(--nm-color-border);
	}
	.form__subject:focus-within {
		box-shadow: inset 0 -2px 0 var(--nm-color-focus);
	}
	.form__label {
		color: var(--nm-color-text-muted);
	}
	.form__input {
		flex: 1;
		min-inline-size: 0;
		min-block-size: var(--nm-space-10);
		padding: 0;
		border: none;
		background: transparent;
		color: var(--nm-color-text);
		font-family: inherit;
		outline: none;
	}
</style>
