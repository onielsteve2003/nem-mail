<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Layers from '@lucide/svelte/icons/layers';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Scale from '@lucide/svelte/icons/scale';
	import { resolve } from '$app/paths';
	import Button from '#components/ui/Button.svelte';
	import ConfirmDialog from '#components/ui/ConfirmDialog.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import ListItem from '#components/ui/ListItem.svelte';
	import SectionHeader from '#components/ui/SectionHeader.svelte';
	import { getAIService } from '#lib/ai/service.svelte.js';
	import { config } from '#lib/config.js';
	import { getDataLayer } from '#lib/data/provider.js';
	import { isAppStorageKey } from '#features/settings/about.js';
	import SettingsScreen from '#features/settings/SettingsScreen.svelte';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { toastStore } from '#lib/stores/toast.svelte.js';
	import { errorMessage } from '#lib/utils/errors.js';

	const COPY = {
		title: 'About and help',
		app: 'Nem Mail',
		tagline:
			'A mobile mail app with on-device AI. A portfolio project; all mail here is demo data.',
		version: (version: string, source: string) => `Version ${version} · ${source} data`,
		help: 'Help',
		tips: [
			[
				'Swipe a conversation',
				'Left or right to archive, delete or more. Change it in Swipe actions.'
			],
			['Select many', 'Long-press a conversation, then tap others to add them.'],
			['Search like a pro', 'Try from:, is:unread, has:attachment or label:.'],
			['Ask the assistant', 'Tap the glowing orb for unread summaries and reply drafts.'],
			['Accept a suggestion', 'Press Tab or swipe right on grey text while writing.']
		],
		more: 'More',
		stack: 'Tech stack',
		stackHint: 'How Nem Mail is built',
		licenses: 'Open-source licenses',
		licensesHint: 'Code and models Nem Mail uses',
		demo: 'Demo data',
		demoHint:
			'Brings back the original mail, labels and settings, and forgets what the AI learned.',
		reset: 'Reset demo data',
		resetTitle: 'Reset demo data?',
		resetMessage:
			'Every change you made to mail, labels, drafts and settings is lost. The app restarts on the inbox.',
		resetFailed: 'Could not reset the demo data.'
	} as const;

	const data = getDataLayer();
	const ai = getAIService();
	const session = getSessionStore();
	const isDemo = config.dataSource === 'mock';

	let isConfirming = $state(false);
	let isResetting = $state(false);

	async function reset(): Promise<void> {
		isResetting = true;
		try {
			await data.resetDemo();
		} catch (error) {
			isResetting = false;
			toastStore.show({ message: errorMessage(error, COPY.resetFailed), tone: 'error' });
			return;
		}
		// Mail is back to the seed; what the AI learned and local preferences go with it.
		// A failure here leaves old lessons, not broken mail, so the restart goes ahead.
		await Promise.allSettled(session.accounts.map((account) => ai.resetLearning(account.id)));
		try {
			for (const key of Object.keys(localStorage)) {
				if (isAppStorageKey(key)) localStorage.removeItem(key);
			}
		} catch {
			// Storage is blocked: there is nothing saved to clear.
		}
		// A fresh start drops every in-memory store, cache and the worker in one go.
		location.replace(resolve('/mail/(list)/[mailbox]', { mailbox: 'inbox' }));
	}
</script>

<SettingsScreen title={COPY.title} fallbackHref={resolve('/settings')}>
	<section class="group intro">
		<h2 class="intro__name nm-text-title-2">{COPY.app}</h2>
		<p class="muted">{COPY.tagline}</p>
		<p class="muted nm-text-caption">
			{COPY.version(config.appVersion, isDemo ? 'Demo' : 'Live')}
		</p>
	</section>

	<section class="group" aria-labelledby="help">
		<SectionHeader id="help" title={COPY.help} />
		<dl class="tips">
			{#each COPY.tips as [title, text] (title)}
				<div class="tip">
					<dt>{title}</dt>
					<dd class="muted">{text}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<nav aria-labelledby="more">
		<div class="group"><SectionHeader id="more" title={COPY.more} /></div>
		<ul class="links" role="list">
			<li>
				<ListItem
					title={COPY.stack}
					subtitle={COPY.stackHint}
					href={resolve('/settings/about/stack')}
				>
					{#snippet leading()}<Icon icon={Layers} />{/snippet}
					{#snippet trailing()}<Icon icon={ChevronRight} size="sm" />{/snippet}
				</ListItem>
			</li>
			<li>
				<ListItem
					title={COPY.licenses}
					subtitle={COPY.licensesHint}
					href={resolve('/settings/about/licenses')}
				>
					{#snippet leading()}<Icon icon={Scale} />{/snippet}
					{#snippet trailing()}<Icon icon={ChevronRight} size="sm" />{/snippet}
				</ListItem>
			</li>
		</ul>
	</nav>

	{#if isDemo}
		<section class="group" aria-labelledby="demo">
			<SectionHeader id="demo" title={COPY.demo} />
			<p class="muted nm-text-caption">{COPY.demoHint}</p>
			<div>
				<Button variant="danger" loading={isResetting} onclick={() => (isConfirming = true)}>
					{#snippet leading()}<Icon icon={RotateCcw} size="sm" />{/snippet}
					{COPY.reset}
				</Button>
			</div>
		</section>
	{/if}
</SettingsScreen>

<ConfirmDialog
	bind:open={isConfirming}
	title={COPY.resetTitle}
	message={COPY.resetMessage}
	confirmLabel={COPY.reset}
	destructive
	onconfirm={() => void reset()}
/>

<style>
	.group {
		display: grid;
		gap: var(--nm-space-3);
		padding: var(--nm-space-3) var(--nm-space-4);
	}
	.intro__name {
		margin: 0;
	}
	.muted {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
	.tips {
		display: grid;
		gap: var(--nm-space-3);
		margin: 0;
	}
	.tip dt {
		font-weight: var(--nm-weight-medium);
	}
	.tip dd {
		margin: 0;
	}
	.links {
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
