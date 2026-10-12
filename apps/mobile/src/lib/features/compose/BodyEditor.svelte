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

	const COPY = {
		body: 'Message body',
		placeholder: 'Write your message',
		toolbar: 'Formatting',
		linkLabel: 'Link address',
		linkPlaceholder: 'example.com',
		addLink: 'Add link',
		cancel: 'Cancel',
		badLink: 'Use a web or email address'
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
	}

	let { value = $bindable('') }: Props = $props();

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

	$effect(() => {
		if (value === emitted) return;
		// The editor has no Svelte-rendered children; the browser owns its content while typing.
		// eslint-disable-next-line svelte/no-dom-manipulating
		editor.innerHTML = sanitizeComposeHtml(value);
		emitted = value;
		isEmpty = !editor.textContent?.trim();
	});

	function emit() {
		emitted = sanitizeComposeHtml(editor.innerHTML);
		value = emitted;
		isEmpty = !editor.textContent?.trim();
	}

	function format(command: FormatCommand) {
		editor.focus();
		runCommand(command);
		emit();
		refreshState();
	}

	function refreshState() {
		if (editor.contains(document.getSelection()?.anchorNode ?? null)) active = formatState();
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
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			openLink();
		}
	}

	$effect(() => {
		document.addEventListener('selectionchange', refreshState);
		return () => document.removeEventListener('selectionchange', refreshState);
	});
</script>

<div class="body">
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
		oninput={emit}
		{onpaste}
		{onkeydown}
	></div>
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
		flex: 1;
		display: flex;
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
