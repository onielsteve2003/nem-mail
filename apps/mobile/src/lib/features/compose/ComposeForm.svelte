<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Send from '@lucide/svelte/icons/send';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import Button from '#components/ui/Button.svelte';
	import ConfirmDialog from '#components/ui/ConfirmDialog.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import { MAX_ATTACHMENT_BYTES } from '@nem/shared';
	import { onDestroy, untrack } from 'svelte';
	import { getRepositories } from '#lib/data/provider.js';
	import { getMailboxStore } from '#lib/stores/mailbox.svelte.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { getThreadStore } from '#lib/stores/thread.svelte.js';
	import { toastStore } from '#lib/stores/toast.svelte.js';
	import { getUiStore, type ComposeRequest } from '#lib/stores/ui.svelte.js';
	import { errorMessage } from '#lib/utils/errors.js';
	import {
		pendingAttachment,
		readyAttachment,
		uploaded,
		uploadWithProgress,
		type ComposeAttachment
	} from './attachments.js';
	import { initialBody } from './body.js';
	import BodyEditor from './BodyEditor.svelte';
	import ComposeAttachments from './ComposeAttachments.svelte';
	import { composeTitle } from './compose.js';
	import { AUTOSAVE_MS, draftKey, newDraftId, toDraft, type DraftFields } from './draft.js';
	import { prefill } from './prefill.js';
	import RecipientField from './RecipientField.svelte';
	import { fromAddresses, type Recipient } from './recipients.js';
	import { sendDraft, sendProblem } from './send.js';

	const COPY = {
		close: 'Close compose',
		send: 'Send',
		attach: 'Attach files',
		to: 'To',
		cc: 'Cc',
		bcc: 'Bcc',
		showCcBcc: 'Show Cc and Bcc',
		subject: 'Subject',
		discard: 'Discard draft',
		discardTitle: 'Discard this draft?',
		discardMessage: 'What you wrote and attached will be deleted.',
		discardConfirm: 'Discard',
		discarded: 'Draft discarded',
		saved: 'Draft saved',
		saving: 'Saving…',
		notSaved: 'Not saved',
		restoreFailed: "Couldn't open the draft. Starting a new message."
	};

	interface Props {
		request: ComposeRequest | null;
		/** Labels the dialog. */
		titleId: string;
		onclose: () => void;
	}

	let { request, titleId, onclose }: Props = $props();

	const repos = getRepositories();
	const session = getSessionStore();
	const threads = getThreadStore();
	const ui = getUiStore();
	const mailbox = getMailboxStore();
	const id = $props.id();
	const title = $derived(composeTitle(request));

	let to = $state<Recipient[]>([]);
	let cc = $state<Recipient[]>([]);
	let bcc = $state<Recipient[]>([]);
	let showCcBcc = $state(false);
	let subject = $state('');
	let bodyHtml = $state('');
	let attachments = $state<ComposeAttachment[]>([]);
	let fileInput: HTMLInputElement | undefined = $state();
	// The picked files, kept so a failed upload can be retried.
	const files: Record<string, File> = {};
	let nextKey = 0;

	// Autosave (FR-5.5). Nothing is saved until the fields differ from what
	// compose opened with, so opening and closing an empty compose leaves no draft.
	let draftId = $state(newDraftId());
	let isReady = $state(false);
	let savedKey = '';
	let hasSaved = false;
	let isClosed = false;
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	// Saves and removes run one after another, so a late save never brings a discarded draft back.
	let queue: Promise<unknown> = Promise.resolve();
	let isDiscardOpen = $state(false);

	const fields = (): DraftFields => ({
		to,
		cc,
		bcc,
		subject,
		bodyHtml,
		attachments: uploaded(attachments)
	});
	const currentKey = $derived(draftKey(fields()));

	// Everything starts here once, when compose opens.
	$effect(() => {
		if (!request) return;
		untrack(async () => {
			if (request.draftId) await restore(request.draftId);
			else await start(request);
			savedKey = draftKey(fields());
			isReady = true;
		});
	});

	$effect(() => {
		const key = currentKey;
		if (!isReady || key === savedKey) return;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => void save(), AUTOSAVE_MS);
	});

	// Closing (X, Escape, Back or navigation) saves at once instead of waiting.
	onDestroy(() => {
		clearTimeout(saveTimer);
		if (isClosed || !isReady || draftKey(fields()) === savedKey) return;
		void save().then((ok) => {
			if (ok) toastStore.show({ message: COPY.saved });
			else toastStore.show({ message: COPY.notSaved, tone: 'error' });
		});
	});

	const meta = () => ({
		id: draftId,
		mode: request?.mode ?? 'new',
		threadId: request?.threadId ?? null,
		inReplyTo: request?.messageId ?? null
	});

	function save(): Promise<boolean> {
		clearTimeout(saveTimer);
		const key = draftKey(fields());
		const draft = toDraft(fields(), meta());
		saveStatus = 'saving';
		const run = queue.then(async () => {
			if (isClosed) return false;
			try {
				await repos.drafts.save(draft);
				savedKey = key;
				hasSaved = true;
				saveStatus = 'saved';
				ui.draftsChanged();
				return true;
			} catch {
				saveStatus = 'error';
				return false;
			}
		});
		queue = run;
		return run;
	}

	/** Validates, closes compose and sends; the toasts take it from there (FR-5.6). */
	async function send() {
		const problem = sendProblem({ to, cc, bcc }, attachments);
		if (problem) {
			toastStore.show({ message: problem, tone: 'error' });
			return;
		}
		isClosed = true;
		clearTimeout(saveTimer);
		const draft = toDraft(fields(), meta());
		const pending = queue;
		onclose();
		// A save still in flight must land first, so sending deletes it instead of it coming back.
		await pending;
		await sendDraft(draft, {
			drafts: repos.drafts,
			toasts: toastStore,
			onsent: ({ threadId }) => {
				mailbox.invalidate();
				ui.draftsChanged();
				void threads.load(threadId, { refresh: true });
			},
			onundo: (restored) => {
				mailbox.invalidate();
				ui.draftsChanged();
				ui.openCompose({
					mode: restored.mode,
					threadId: restored.threadId,
					messageId: restored.inReplyTo,
					draftId: restored.id
				});
			}
		});
	}

	async function discard() {
		isClosed = true;
		clearTimeout(saveTimer);
		onclose();
		if (hasSaved) {
			queue = queue.then(() => repos.drafts.remove(draftId).catch(() => {}));
			await queue;
			ui.draftsChanged();
		}
		toastStore.show({ message: COPY.discarded });
	}

	/** Opens a saved draft (FR-5.5); if it cannot load, compose starts fresh under a new id. */
	async function restore(id: string) {
		try {
			const draft = await repos.drafts.get(id);
			draftId = draft.id;
			hasSaved = true;
			to = fromAddresses(draft.to);
			cc = fromAddresses(draft.cc);
			bcc = fromAddresses(draft.bcc);
			showCcBcc = cc.length + bcc.length > 0;
			subject = draft.subject;
			bodyHtml = draft.bodyHtml;
			attachments = draft.attachments.map(readyAttachment);
		} catch {
			toastStore.show({ message: COPY.restoreFailed, tone: 'error' });
			await start({ mode: 'new', threadId: null, messageId: null });
		}
	}

	/**
	 * Fills in the signature (FR-5.8) and, for a reply or forward, the recipients,
	 * subject and quote (FR-5.1). Only empty fields are filled, so nothing the
	 * user typed while settings loaded is lost.
	 */
	async function start({ mode, threadId, messageId }: ComposeRequest) {
		// No signature is better than a broken compose; the user can still write.
		const signature = await repos.settings
			.get()
			.then((settings) => settings.signature)
			.catch(() => '');
		if (mode === 'new' || !threadId || !messageId) {
			if (!bodyHtml) bodyHtml = initialBody(signature);
			return;
		}
		await threads.load(threadId);
		const message = threads.get(threadId)?.thread?.messages.find((m) => m.id === messageId);
		if (!message) {
			if (!bodyHtml) bodyHtml = initialBody(signature);
			return;
		}
		const fill = prefill(mode, message, session.user?.email, signature);
		if (!to.length) to = fromAddresses(fill.to);
		if (!cc.length) cc = fromAddresses(fill.cc);
		if (cc.length) showCcBcc = true;
		if (!subject) subject = fill.subject;
		if (!bodyHtml) bodyHtml = fill.bodyHtml;
	}

	function addFiles(list: FileList | null) {
		for (const file of list ?? []) {
			const key = `file-${nextKey++}`;
			files[key] = file;
			const item = pendingAttachment(file, key);
			attachments.push(item);
			if (item.status === 'uploading') void upload(key);
		}
		// Lets the same file be picked again after it was removed.
		if (fileInput) fileInput.value = '';
	}

	function update(key: string, patch: Partial<ComposeAttachment>) {
		const item = attachments.find((a) => a.key === key);
		if (item) Object.assign(item, patch);
	}

	async function upload(key: string) {
		const file = files[key];
		if (!file) return;
		update(key, { status: 'uploading', progress: 0, error: null });
		try {
			const attachment = await uploadWithProgress(
				file,
				(f) => repos.drafts.uploadAttachment(f),
				(progress) => update(key, { progress })
			);
			update(key, { status: 'ready', attachment });
		} catch (error) {
			update(key, { status: 'error', error: errorMessage(error, 'Upload failed') });
		}
	}

	function removeAttachment(key: string) {
		delete files[key];
		attachments = attachments.filter((a) => a.key !== key);
	}

	// Files over the limit cannot be retried; failed uploads can.
	const canRetry = (key: string) => {
		const file = files[key];
		return !!file && file.size <= MAX_ATTACHMENT_BYTES;
	};

	const search = (q: string) => repos.contacts.search({ q, limit: 8 });
</script>

<header class="form__head">
	<IconButton icon={X} label={COPY.close} onclick={onclose} />
	<div class="form__heading">
		<h2 id={titleId} class="form__title nm-text-title-3 nm-text-truncate">{title}</h2>
		<p class="form__status nm-text-caption" aria-live="polite">
			{#if saveStatus === 'saving'}{COPY.saving}{:else if saveStatus === 'saved'}{COPY.saved}{:else if saveStatus === 'error'}{COPY.notSaved}{/if}
		</p>
	</div>
	<IconButton icon={Paperclip} label={COPY.attach} onclick={() => fileInput?.click()} />
	<input
		bind:this={fileInput}
		class="nm-visually-hidden"
		type="file"
		multiple
		tabindex="-1"
		aria-hidden="true"
		onchange={(event) => addFiles(event.currentTarget.files)}
	/>
	<IconButton icon={Trash2} label={COPY.discard} onclick={() => (isDiscardOpen = true)} />
	<Button size="sm" disabled={!isReady} onclick={send}>
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
	<ComposeAttachments items={attachments} onremove={removeAttachment} onretry={upload} {canRetry} />
	<BodyEditor bind:value={bodyHtml} />
</div>
<ConfirmDialog
	bind:open={isDiscardOpen}
	title={COPY.discardTitle}
	message={COPY.discardMessage}
	confirmLabel={COPY.discardConfirm}
	destructive
	onconfirm={discard}
/>

<style>
	.form__head {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		padding: var(--nm-space-2) var(--nm-space-3);
		border-block-end: 1px solid var(--nm-color-border);
	}
	.form__heading {
		flex: 1;
		min-inline-size: 0;
	}
	.form__title {
		margin: 0;
	}
	.form__status {
		margin: 0;
		min-block-size: 1lh;
		color: var(--nm-color-text-muted);
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
