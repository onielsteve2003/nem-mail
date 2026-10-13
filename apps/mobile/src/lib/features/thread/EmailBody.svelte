<script lang="ts">
	import ImageOff from '@lucide/svelte/icons/image-off';
	import Button from '#components/ui/Button.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import { sanitizeEmail } from './sanitize.js';

	const IMAGES_HIDDEN = 'Images are hidden to protect your privacy.';
	const SHOW_IMAGES = 'Show images';

	// The email's own CSS lives in a shadow root, so it can't restyle the app
	// and the app can't break it. Tokens still reach in through custom properties.
	const BASE_CSS = `
		:host { display: block; color: inherit; font: inherit; overflow-wrap: anywhere; }
		.root { overflow-x: auto; }
		img, video { max-width: 100%; height: auto; }
		table { max-width: 100%; }
		a { color: var(--nm-color-accent-text); }
		pre { white-space: pre-wrap; }
		blockquote { margin-inline: 0; padding-inline-start: var(--nm-space-3);
			border-inline-start: 2px solid var(--nm-color-border-strong); color: var(--nm-color-text-muted); }
	`;

	interface Props {
		/** Untrusted HTML, or null for plain-text mail (FR-4.3 fallback). */
		html: string | null;
		text: string;
	}

	let { html, text }: Props = $props();

	let showImages = $state(false);
	const safe = $derived(html === null ? null : sanitizeEmail(html, { allowRemote: showImages }));

	function render(node: HTMLElement): void {
		if (!safe) return;
		const root = node.shadowRoot ?? node.attachShadow({ mode: 'open' });
		root.innerHTML = `<style>${BASE_CSS}</style><div class="root">${safe.html}</div>`;
	}
</script>

{#if safe}
	{#if safe.blockedImages > 0}
		<div class="images" role="note">
			<Icon icon={ImageOff} size="sm" />
			<span class="images__text nm-text-caption">{IMAGES_HIDDEN}</span>
			<Button variant="ghost" size="sm" onclick={() => (showImages = true)}>{SHOW_IMAGES}</Button>
		</div>
	{/if}
	<div
		class={['html', 'nm-selectable', { 'html--paper': safe.hasOwnColors }]}
		{@attach render}
	></div>
{:else}
	<div class="text nm-selectable">{text}</div>
{/if}

<style>
	.images {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		margin-block-end: var(--nm-space-3);
		padding: var(--nm-space-1) var(--nm-space-1) var(--nm-space-1) var(--nm-space-3);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-2);
		color: var(--nm-color-text-muted);
	}
	.images__text {
		flex: 1;
	}
	.html,
	.text {
		color: var(--nm-color-text);
	}
	/* Mail with its own colors keeps them on a light sheet in both themes. */
	.html--paper {
		padding: var(--nm-space-3);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-paper);
		color: var(--nm-color-paper-text);
		color-scheme: light;
		/* Links and quotes inside the shadow root read these. */
		--nm-color-accent-text: var(--nm-color-paper-link);
		--nm-color-text-muted: var(--nm-color-paper-muted);
		--nm-color-border-strong: var(--nm-color-paper-border);
	}
	.text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
