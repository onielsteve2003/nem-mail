import 'fake-indexeddb/auto';
import type { ServerEvent, ThreadSummary } from '@nem/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelStore } from '#lib/ai/model-store.js';
import { AIService } from '#lib/ai/service.svelte.js';
import { createWorkerApi } from '#lib/ai/worker/api.js';
import type { Repositories } from '#lib/data/repositories.js';
import { DEMO_EMAIL, createTestRepositories } from '#lib/data/testing.js';
import { MailboxStore } from './mailbox.svelte.js';
import { connectSpamFilter, receivedMessages, spamFeedback } from './spam-filter.js';
import { ToastStore } from './toast.svelte.js';

const NOW = Date.parse('2026-10-11T09:00:00.000Z');

function memoryStore(): ModelStore & { saved: Map<string, unknown> } {
	const saved = new Map<string, unknown>();
	return {
		saved,
		get: async (key) => saved.get(key),
		put: async (key, value) => void saved.set(key, structuredClone(value))
	};
}

let repos: Repositories;
let close: () => void;
let toasts: ToastStore;
let mailbox: MailboxStore;
let ai: AIService;
let store: ReturnType<typeof memoryStore>;
let emit: (event: ServerEvent) => void;
let stop: () => void;
let user: { id: string; email: string };

beforeEach(async () => {
	const created = await createTestRepositories(NOW);
	repos = created.repos;
	close = () => created.db.close();
	const session = await repos.auth.signIn({ email: DEMO_EMAIL, password: 'anything-goes' });
	user = session.user;
	toasts = new ToastStore();
	mailbox = new MailboxStore({ mail: repos.mail, toasts, now: () => NOW });
	store = memoryStore();
	const api = createWorkerApi(
		{} as never,
		() => [],
		async () => 'wasm',
		store
	);
	ai = new AIService(null, async () => ({ api, terminate() {} }));
	const subscribe = (listener: (event: ServerEvent) => void) => {
		emit = listener;
		return () => {};
	};
	// Real repository, but the test plays the server's mail.new events.
	const mail = new Proxy(repos.mail, {
		get: (target, key) => {
			if (key === 'subscribe') return subscribe;
			const value = Reflect.get(target, key);
			return typeof value === 'function' ? value.bind(target) : value;
		}
	});
	stop = connectSpamFilter({ mail, mailbox, ai, user: () => user, toasts });
});

afterEach(() => {
	stop();
	toasts.clear();
	close();
});

async function firstIn(mailboxName: 'spam' | 'inbox'): Promise<ThreadSummary> {
	const page = await repos.mail.list({ mailbox: mailboxName });
	return page.items[0]!;
}

describe('spam feedback helpers', () => {
	it('maps ops to lessons and skips the user’s own messages', () => {
		expect(spamFeedback({ op: 'spam' })).toBe(true);
		expect(spamFeedback({ op: 'move', to: 'spam' })).toBe(true);
		expect(spamFeedback({ op: 'notSpam' })).toBe(false);
		expect(spamFeedback({ op: 'archive' })).toBeNull();
		const mine = { from: { email: 'Me@Example.com' } } as never;
		const theirs = { from: { email: 'ada@example.com' } } as never;
		expect(receivedMessages([mine, theirs], 'me@example.com')).toEqual([theirs]);
	});
});

describe('connectSpamFilter', () => {
	it('moves new spam out of the inbox and offers Not spam', async () => {
		const spam = await firstIn('spam');
		// Back in the inbox without a lesson, as if it had just arrived.
		await mailbox.apply([spam.id], { op: 'notSpam' }, { undoable: false });
		emit({ type: 'mail.new', summary: { ...spam, mailboxes: ['inbox'] } });
		await vi.waitFor(async () =>
			expect((await repos.mail.get(spam.id)).mailboxes).toContain('spam')
		);
		expect(toasts.current).toMatchObject({
			message: `Moved to Spam: ${spam.subject}`,
			action: { label: 'Not spam' }
		});
		expect(store.saved.size).toBe(0);
	});

	it('leaves normal new mail in the inbox', async () => {
		const inbox = await firstIn('inbox');
		const classify = vi.spyOn(ai, 'classifySpam');
		emit({ type: 'mail.new', summary: inbox });
		await vi.waitFor(() => expect(classify).toHaveBeenCalled());
		await classify.mock.results[0]!.value;
		expect((await repos.mail.get(inbox.id)).mailboxes).toContain('inbox');
	});

	it('learns from Report spam and saves the model for the user', async () => {
		const inbox = await firstIn('inbox');
		await mailbox.apply([inbox.id], { op: 'spam' });
		await vi.waitFor(() => expect(store.saved.has(`${user.id}:spam`)).toBe(true));
	});

	it('does nothing when spam detection is off', async () => {
		ai.toggles.spam = false;
		const inbox = await firstIn('inbox');
		const learn = vi.spyOn(ai, 'learnSpam');
		await mailbox.apply([inbox.id], { op: 'spam' });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(learn).not.toHaveBeenCalled();
	});
});
