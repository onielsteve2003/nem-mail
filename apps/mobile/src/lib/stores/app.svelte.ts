import { untrack } from 'svelte';
import { AIService, setAIService } from '#lib/ai/service.svelte.js';
import type { Repositories } from '#lib/data/repositories.js';
import { MailboxStore, setMailboxStore } from './mailbox.svelte.js';
import { SelectionStore, setSelectionStore } from './selection.svelte.js';
import { SessionStore, setSessionStore } from './session.svelte.js';
import { ThreadStore, setThreadStore } from './thread.svelte.js';
import { UiStore, setUiStore } from './ui.svelte.js';

/** Every app store, created once in the root layout. */
export interface AppStores {
	session: SessionStore;
	mailbox: MailboxStore;
	thread: ThreadStore;
	selection: SelectionStore;
	ui: UiStore;
	ai: AIService;
}

/** Builds the stores over one set of repositories; `sync` checks for new mail (pull to refresh). */
export function createAppStores(repos: Repositories, sync?: () => Promise<void>): AppStores {
	const thread = new ThreadStore(repos.mail);
	return {
		session: new SessionStore(repos.auth),
		mailbox: new MailboxStore({ mail: repos.mail, threads: thread, sync }),
		thread,
		selection: new SelectionStore(),
		ui: new UiStore(),
		ai: new AIService(repos.settings, undefined, repos.contacts, repos.mail)
	};
}

/** Shares the stores with every component below; call during component init. */
export function setAppStores(stores: AppStores): void {
	setSessionStore(stores.session);
	setMailboxStore(stores.mailbox);
	setThreadStore(stores.thread);
	setSelectionStore(stores.selection);
	setUiStore(stores.ui);
	setAIService(stores.ai);
}

/**
 * Drops one account's mail when another user takes over (switch, sign out),
 * so the next account never sees the last one's lists. Returns a stop function.
 */
export function resetOnUserChange(stores: AppStores): () => void {
	let previous: string | null | undefined;
	return $effect.root(() => {
		$effect(() => {
			const userId = stores.session.user?.id ?? null;
			// Each account has its own AI toggles.
			if (userId) untrack(() => void stores.ai.loadToggles());
			if (previous !== undefined && userId !== previous) {
				untrack(() => {
					stores.mailbox.reset();
					stores.thread.reset();
					stores.selection.clear();
					stores.ui.closeAll();
					stores.ui.scroll.clear();
					stores.ai.clearInsights();
				});
			}
			previous = userId;
		});
	});
}
