<script lang="ts">
	import TextField from '#components/ui/TextField.svelte';
	import Toggle from '#components/ui/Toggle.svelte';
	import {
		autoReplySubject,
		fromDateInput,
		toDateInput,
		vacationRangeError,
		vacationStatus,
		type Vacation
	} from './account.js';
	import TextArea from './TextArea.svelte';

	const COPY = {
		toggle: 'Vacation responder',
		toggleHint: 'Answers new mail for you while you are away',
		first: 'First day',
		last: 'Last day',
		lastHint: 'Leave empty to keep it on until you turn it off',
		subject: 'Subject',
		subjectHint: 'Empty: "Re:" and the subject of the mail it answers',
		message: 'Message',
		preview: 'What senders get',
		sampleSubject: 'Lunch on Friday?',
		empty: 'Write a message to see the reply.',
		phase: 'Auto-replies are sent once the Nem Mail server is live. Your setup is saved now.',
		status: {
			off: 'Off',
			scheduled: 'Scheduled: starts on the first day',
			active: 'On: answering new mail',
			ended: 'Ended: the last day has passed'
		}
	} as const;

	interface Props {
		vacation: Vacation;
		onsave: (vacation: Vacation) => void;
		disabled?: boolean;
	}

	let { vacation, onsave, disabled = false }: Props = $props();

	// Drafts follow saved settings and save on change (blur), not on every key press.
	let subject = $derived(vacation.subject);
	let message = $derived(vacation.message);
	let rangeError = $state<string | null>(null);

	const status = $derived(vacationStatus(vacation));

	function save(patch: Partial<Vacation>): void {
		const next = { ...vacation, ...patch };
		rangeError = vacationRangeError(next);
		if (!rangeError) onsave(next);
	}
</script>

<Toggle
	label={COPY.toggle}
	description={COPY.toggleHint}
	checked={vacation.enabled}
	{disabled}
	onchange={(event) => save({ enabled: event.currentTarget.checked })}
/>
<p class="status nm-text-caption" role="status">{COPY.status[status]}</p>

{#if vacation.enabled}
	<div class="dates">
		<TextField
			label={COPY.first}
			type="date"
			value={toDateInput(vacation.startsAt)}
			{disabled}
			onchange={(event) => save({ startsAt: fromDateInput(event.currentTarget.value, 'start') })}
		/>
		<TextField
			label={COPY.last}
			type="date"
			value={toDateInput(vacation.endsAt)}
			hint={COPY.lastHint}
			error={rangeError ?? undefined}
			{disabled}
			onchange={(event) => save({ endsAt: fromDateInput(event.currentTarget.value, 'end') })}
		/>
	</div>
	<TextField
		label={COPY.subject}
		hint={COPY.subjectHint}
		bind:value={subject}
		{disabled}
		onchange={() => save({ subject })}
	/>
	<TextArea
		label={COPY.message}
		bind:value={message}
		{disabled}
		onchange={() => save({ message })}
	/>

	<figure class="preview">
		<figcaption class="nm-text-caption">{COPY.preview}</figcaption>
		<p class="preview__subject">{autoReplySubject({ ...vacation, subject }, COPY.sampleSubject)}</p>
		<p class="preview__body">{message.trim() || COPY.empty}</p>
	</figure>
	<p class="status nm-text-caption">{COPY.phase}</p>
{/if}

<style>
	.status {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
	.dates {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: var(--nm-space-3);
	}
	.preview {
		display: grid;
		gap: var(--nm-space-1);
		margin: 0;
		padding: var(--nm-space-4);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-1);
	}
	.preview figcaption {
		color: var(--nm-color-text-muted);
	}
	.preview p {
		margin: 0;
	}
	.preview__subject {
		font-weight: var(--nm-weight-medium);
	}
	.preview__body {
		white-space: pre-wrap;
		color: var(--nm-color-text-muted);
	}
</style>
