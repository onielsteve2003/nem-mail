<script lang="ts">
	import Bold from '@lucide/svelte/icons/bold';
	import Italic from '@lucide/svelte/icons/italic';
	import Link from '@lucide/svelte/icons/link';
	import List from '@lucide/svelte/icons/list';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import Button from '#components/ui/Button.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import { normalizeLink, sanitizeComposeHtml, textToHtml } from './body.js';
	import { formatState, runCommand, type FormatCommand } from './editor.js';
	import {
		caretText,
		ghostPlace,
		isAcceptSwipe,
		SUGGEST_DELAY_MS,
		type GhostPlace
	} from './ghost.js';

	const COPY = {
		body: 'Message body',
		placeholder: 'Write your message',
		toolbar: 'Formatting',
		linkLabel: 'Link address',
		linkPlaceholder: 'example.com',
		addLink: 'Add link',
		cancel: 'Cancel',
		badLink: 'Use a web or email address',
		accept: 'Tab',
		suggestion: (text: string) =>
			`AI suggestion: ${text}. Press Tab or swipe right to accept. It comes from a model on this device trained on your sent mail.`
	};
	const TOOLS = [
		{ command: 'bold', icon: Bold, label: 'Bold' },
		{ command: 'italic', icon: Italic, label: 'Italic' },
		{ command: 'insertUnorderedList', icon: List, label: 'Bulleted list' },
		{ command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' }
	] as const satisfies { command: FormatCommand; icon: unknown; label: string }[];

	interface Props {
		/** Sanitized HTML. Setting it from outside (signature, reply quote) replaces the content. */
		value?: string;
		/** Smart compose (AI-5): ghost text for the paragraph before the caret, or null. */
		suggest?: (before: string) => Promise<string | null>;
	}

	let { value = $bindable(''), suggest }: Props = $props();

	const id = $props.id();
	let editor: HTMLDivElement;
	let linkInput = $state<HTMLInputElement>();
	let active = $state<Record<FormatCommand, boolean>>(formatState());
	let isEmpty = $state(true);
	let linkUrl = $state('');
	let linkError = $state('');
	let isLinking = $state(false);
	// What the editor last emitted, so only outside changes rewrite the DOM (and the caret).
	let emitted: string | null = null;
	let savedRange: Range | null = null;
	let wrapper: HTMLDivElement;
	let ghost = $state<(GhostPlace & { text: string }) | null>(null);
	let suggestTimer: ReturnType<typeof setTimeout> | undefined;
	let suggestRun = 0;
	let touchStart: { x: number; y: number } | null = null;

	$effect(() => {
		if (value === emitted) return;
		// The editor has no Svelte-rendered children; the browser owns its content while typing.
		// eslint-disable-next-line svelte/no-dom-manipulating
		editor.innerHTML = sanitizeComposeHtml(value);
		emitted = value;
		clearGhost();
		isEmpty = !editor.textContent?.trim();
	});

	function emit() {
		emitted = sanitizeComposeHtml(editor.innerHTML);
		value = emitted;
		isEmpty = !editor.textContent?.trim();
		scheduleSuggestion();
	}

	function clearGhost() {
		clearTimeout(suggestTimer);
		suggestRun += 1;
		ghost = null;
	}

	function scheduleSuggestion() {
		clearGhost();
		if (!suggest) return;
		const run = suggestRun;
		suggestTimer = setTimeout(async () => {
			const context = caretText(editor);
			if (!context?.before.trim()) return;
			const text = await suggest(context.before).catch(() => null);
			// Typing or moving the caret since then makes the answer stale.
			if (run !== suggestRun || !text) return;
			const place = ghostPlace(context.caret, wrapper, editor);
			if (place) ghost = { ...place, text };
		}, SUGGEST_DELAY_MS);
	}

	function acceptGhost() {
		if (!ghost) return;
		const { text } = ghost;
		clearGhost();
		editor.focus();
		runCommand('insertText', text);
		emit();
	}

	function format(command: FormatCommand) {
		editor.focus();
		runCommand(command);
		emit();
		refreshState();
	}

	function refreshState() {
		if (editor.contains(document.getSelection()?.anchorNode ?? null)) active = formatState();
		// The caret moved (typing reschedules a new suggestion after this).
		if (ghost) clearGhost();
	}

	function ontouchstart(event: TouchEvent) {
		const touch = event.touches[0];
		touchStart = ghost && touch ? { x: touch.clientX, y: touch.clientY } : null;
	}

	function ontouchend(event: TouchEvent) {
		const touch = event.changedTouches[0];
		if (!touchStart || !touch) return;
		const accepted = isAcceptSwipe(touch.clientX - touchStart.x, touch.clientY - touchStart.y);
		touchStart = null;
		if (accepted) acceptGhost();
	}

	function openLink() {
		const selection = document.getSelection();
		savedRange =
			selection?.rangeCount && editor.contains(selection.anchorNode)
				? selection.getRangeAt(0).cloneRange()
				: null;
		linkUrl = '';
		linkError = '';
		isLinking = true;
		queueMicrotask(() => linkInput?.focus());
	}

	function closeLink() {
		isLinking = false;
		editor.focus();
		restoreRange();
	}

	function restoreRange() {
		if (!savedRange) return;
		const selection = document.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(savedRange);
	}

	function addLink(event: SubmitEvent) {
		event.preventDefault();
		const href = normalizeLink(linkUrl);
		if (!href) {
			linkError = COPY.badLink;
			return;
		}
		isLinking = false;
		editor.focus();
		restoreRange();
		if (savedRange && !savedRange.collapsed) runCommand('createLink', href);
		else runCommand('insertHTML', `<a href="${href}">${textToHtml(linkUrl.trim())}</a>`);
		emit();
	}

	function onpaste(event: ClipboardEvent) {
		const data = event.clipboardData;
		if (!data) return;
		event.preventDefault();
		const html = data.getData('text/html');
		runCommand(
			'insertHTML',
			html ? sanitizeComposeHtml(html) : textToHtml(data.getData('text/plain'))
		);
		emit();
	}

	function onkeydown(event: KeyboardEvent) {
		if (ghost && event.key === 'Tab' && !event.shiftKey) {
			event.preventDefault();
			acceptGhost();
			return;
		}
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			openLink();
		}
	}

	$effect(() => {
		document.addEventListener('selectionchange', refreshState);
		return () => {
			document.removeEventListener('selectionchange', refreshState);
			clearTimeout(suggestTimer);
		};
	});
</script>

<div class="body" bind:this={wrapper}>
	<div
		bind:this={editor}
		class="body__editor nm-text-body-lg"
		contenteditable="true"
		role="textbox"
		tabindex="0"
		aria-multiline="true"
		aria-label={COPY.body}
		data-placeholder={COPY.placeholder}
		data-empty={isEmpty || undefined}
		aria-describedby={ghost ? `${id}-ghost` : undefined}
		oninput={emit}
		onblur={clearGhost}
		{onpaste}
		{onkeydown}
		{ontouchstart}
		{ontouchend}
	></div>
	{#if ghost}
		<div
			class="ghost nm-text-body-lg"
			style:inset-block-start="{ghost.top}px"
			style:text-indent="{ghost.indent}px"
			aria-hidden="true"
		>
			{ghost.text}<span class="ghost__key nm-text-caption">{COPY.accept}</span>
		</div>
		<p id="{id}-ghost" class="nm-visually-hidden">{COPY.suggestion(ghost.text)}</p>
	{/if}
</div>

{#if isLinking}
	<form class="link" onsubmit={addLink}>
		<label class="link__label nm-text-label" for="{id}-link">{COPY.linkLabel}</label>
		<input
			bind:this={linkInput}
			bind:value={linkUrl}
			id="{id}-link"
			class="link__input"
			type="text"
			inputmode="url"
			autocapitalize="off"
			spellcheck="false"
			placeholder={COPY.linkPlaceholder}
			aria-invalid={linkError ? 'true' : undefined}
			aria-describedby={linkError ? `${id}-link-error` : undefined}
			onkeydown={(event) => {
				// Closes the link row only, not compose.
				if (event.key === 'Escape') {
					event.stopPropagation();
					closeLink();
				}
			}}
		/>
		<Button size="sm" variant="ghost" onclick={closeLink}>{COPY.cancel}</Button>
		<Button size="sm" type="submit">{COPY.addLink}</Button>
		{#if linkError}
			<p class="link__error nm-text-caption" id="{id}-link-error">{linkError}</p>
		{/if}
	</form>
{/if}

<!-- mousedown is cancelled so the editor keeps its selection while a tool is pressed. -->
<div
	class="toolbar"
	role="toolbar"
	aria-label={COPY.toolbar}
	tabindex="-1"
	onmousedown={(event) => event.preventDefault()}
>
	{#each TOOLS as tool (tool.command)}
		<IconButton
			icon={tool.icon}
			label={tool.label}
			aria-pressed={active[tool.command]}
			onclick={() => format(tool.command)}
		/>
	{/each}
	<IconButton icon={Link} label={COPY.addLink} aria-expanded={isLinking} onclick={openLink} />
</div>

<style>
	.body {
		position: relative;
		flex: 1;
		display: flex;
	}
	/* Drawn over the editor at the caret; the editor's own text is never touched. */
	.ghost {
		position: absolute;
		inset-inline: var(--nm-space-4);
		color: var(--nm-color-text-subtle);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		pointer-events: none;
	}
	.ghost__key {
		display: inline-block;
		margin-inline-start: var(--nm-space-2);
		padding-inline: var(--nm-space-1);
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-sm);
		text-indent: 0;
		vertical-align: middle;
	}
	.body__editor {
		position: relative;
		flex: 1;
		min-block-size: 12rem;
		padding: var(--nm-space-4);
		color: var(--nm-color-text);
		overflow-wrap: anywhere;
		outline: none;
	}
	.body__editor[data-empty]::before {
		content: attr(data-placeholder);
		position: absolute;
		color: var(--nm-color-text-subtle);
		pointer-events: none;
	}
	.body__editor :global(a) {
		color: var(--nm-color-accent-text);
	}
	.body__editor :global(blockquote) {
		margin: var(--nm-space-2) 0;
		padding-inline-start: var(--nm-space-3);
		border-inline-start: 2px solid var(--nm-color-border-strong);
		color: var(--nm-color-text-muted);
	}
	.link {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nm-space-2);
		padding: var(--nm-space-2) var(--nm-space-3);
		border-block-start: 1px solid var(--nm-color-border);
	}
	.link__label {
		flex-basis: 100%;
		color: var(--nm-color-text-muted);
	}
	.link__input {
		flex: 1;
		min-inline-size: 8rem;
		min-block-size: var(--nm-space-10);
		padding-inline: var(--nm-space-3);
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-1);
		color: var(--nm-color-text);
		font: inherit;
	}
	.link__input:focus-visible {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: 1px;
	}
	.link__error {
		flex-basis: 100%;
		margin: 0;
		color: var(--nm-color-danger);
	}
	.toolbar {
		position: sticky;
		inset-block-end: 0;
		display: flex;
		gap: var(--nm-space-1);
		padding: var(--nm-space-1) var(--nm-space-2);
		border-block-start: 1px solid var(--nm-color-border);
		background: var(--nm-color-surface-2);
	}
</style>
