import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ENDPOINTS, type Draft, type EndpointName, type SessionResponse } from '@nem/shared';
import type { Repositories } from '../repositories.js';
import { createHttpRepositories } from './index.js';
import { SESSIONS_KEY, type TokenStorage } from './session-tokens.js';

/**
 * Contract tests: every repository method runs against the responses the Java API recorded
 * (packages/shared/fixtures/api, written by ApiContractFixturesTest), so a drift between the two
 * shows up as a parse failure here.
 */
const DIR = join(
	import.meta.dirname,
	'..',
	'..',
	'..',
	'..',
	'..',
	'..',
	'packages/shared/fixtures/api'
);
const BASE = 'https://api.example/api/v1';

const fixture = <T = unknown>(name: string): T =>
	JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8')) as T;

/** Which endpoint a request is for, by method and path pattern. */
function endpointFor(method: string, url: string): EndpointName {
	const path = new URL(url).pathname.slice(new URL(BASE).pathname.length);
	const match = (Object.keys(ENDPOINTS) as EndpointName[]).find((name) => {
		const endpoint = ENDPOINTS[name];
		const pattern = new RegExp(`^${endpoint.path.replace(/:\w+/g, '[^/]+')}$`);
		return endpoint.method === method && pattern.test(path);
	});
	if (!match) throw new Error(`No endpoint for ${method} ${path}`);
	return match;
}

function memoryStorage(): TokenStorage {
	const data: Record<string, string> = {};
	return {
		getItem: (key) => data[key] ?? null,
		setItem: (key, value) => {
			data[key] = value;
		},
		removeItem: (key) => {
			delete data[key];
		}
	};
}

interface Call {
	name: EndpointName;
	url: string;
	init: RequestInit | undefined;
}

function setup(answer?: (name: EndpointName) => Response | undefined) {
	const calls: Call[] = [];
	const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
		const name = endpointFor(init?.method ?? 'GET', String(input));
		calls.push({ name, url: String(input), init });
		const custom = answer?.(name);
		if (custom) return custom;
		if (name === 'getAttachment') return new Response('notes');
		return Response.json(fixture(name));
	});
	const storage = memoryStorage();
	const repos: Repositories = createHttpRepositories(BASE, {
		fetch,
		storage,
		retries: 0
	});
	return { repos, calls, storage };
}

async function signedIn() {
	const setupResult = setup();
	await setupResult.repos.auth.signIn({ email: 'ada@nemmail.example', password: 'x'.repeat(8) });
	return setupResult;
}

describe('HTTP repositories against the recorded API responses', () => {
	it('auth: signs in, keeps the token, and sends it on later calls', async () => {
		const { repos, calls, storage } = await signedIn();
		const session = fixture<SessionResponse>('signIn');
		expect(await repos.auth.me()).toEqual(fixture('me'));
		expect(calls.at(-1)?.init?.headers).toHaveProperty('Authorization', `Bearer ${session.token}`);
		expect((await repos.auth.listAccounts()).map((a) => a.id)).toEqual([session.user.id]);
		expect(storage.getItem(SESSIONS_KEY)).toContain(session.token);
	});

	it('auth: signs up, switches accounts, and signs out of the active one', async () => {
		const { repos } = await signedIn();
		const signUp = fixture<SessionResponse>('signUp');
		await repos.auth.signUp({ name: 'Ada', email: 'ada@nemmail.example', password: 'x'.repeat(8) });
		expect(await repos.auth.listAccounts()).toHaveLength(
			signUp.user.id === fixture<SessionResponse>('signIn').user.id ? 1 : 2
		);
		await expect(repos.auth.switchAccount(signUp.user.id)).resolves.toEqual(fixture('me'));
		await repos.auth.signOut();
		expect((await repos.auth.listAccounts()).map((a) => a.id)).not.toContain(signUp.user.id);
	});

	it('auth: is signed out without a token, and a 401 drops the token', async () => {
		const unauthorized = setup((name) =>
			name === 'me' ? Response.json(fixture('error.unauthorized'), { status: 401 }) : undefined
		);
		expect(await unauthorized.repos.auth.me()).toBeNull();
		expect(unauthorized.calls).toHaveLength(0);
		await unauthorized.repos.auth.signIn({ email: 'a@b.example', password: 'x'.repeat(8) });
		expect(await unauthorized.repos.auth.me()).toBeNull();
		expect(await unauthorized.repos.auth.listAccounts()).toEqual([]);
	});

	it('mail: lists, opens, applies ops, deletes, counts, and downloads', async () => {
		const { repos, calls } = await signedIn();
		expect(await repos.mail.list({ mailbox: 'inbox' }, { limit: 20 })).toEqual(
			fixture('listThreads')
		);
		expect(fetchUrl(calls, 'listThreads')).toBe(`${BASE}/threads?mailbox=inbox&limit=20`);
		await repos.mail.list({ labelId: 'l1' });
		expect(fetchUrl(calls, 'listThreads')).toBe(`${BASE}/threads?label=l1`);
		expect(await repos.mail.get('t1')).toEqual(fixture('getThread'));
		expect(await repos.mail.apply(['t1'], { op: 'star' })).toEqual(fixture('bulkThreads'));
		expect(await repos.mail.deleteForever(['t1'])).toEqual(fixture('deleteThreads'));
		expect(await repos.mail.empty('trash')).toEqual(fixture('emptyMailbox'));
		expect(await repos.mail.counts()).toEqual(fixture('counts'));
		expect(await (await repos.mail.getAttachment('a1')).text()).toBe('notes');
	});

	it('mail: skips the request when there is nothing to change', async () => {
		const { repos, calls } = await signedIn();
		const before = calls.length;
		expect(await repos.mail.apply([], { op: 'archive' })).toEqual({ updatedIds: [] });
		expect(await repos.mail.deleteForever([])).toEqual({ updatedIds: [] });
		expect(calls).toHaveLength(before);
	});

	it('labels: lists, creates, updates, and removes', async () => {
		const { repos } = await signedIn();
		expect(await repos.labels.list()).toEqual(fixture('listLabels'));
		expect(await repos.labels.create({ name: 'Work', color: 'lime', parentId: null })).toEqual(
			fixture('createLabel')
		);
		expect(await repos.labels.update('l1', { name: 'Projects' })).toEqual(fixture('updateLabel'));
		await expect(repos.labels.remove('l1')).resolves.toBeUndefined();
	});

	it('drafts: saves, reads, uploads, sends, and cancels', async () => {
		const { repos, calls } = await signedIn();
		const draft = fixture<Draft>('getDraft');
		expect(await repos.drafts.list()).toEqual(fixture('listDrafts'));
		expect(await repos.drafts.get(draft.id)).toEqual(draft);
		expect(await repos.drafts.save(draft)).toEqual(fixture('saveDraft'));
		expect(fetchUrl(calls, 'saveDraft')).toBe(`${BASE}/drafts/${draft.id}`);
		await expect(repos.drafts.remove(draft.id)).resolves.toBeUndefined();
		const file = new File(['notes'], 'notes.txt', { type: 'text/plain' });
		expect(await repos.drafts.uploadAttachment(file)).toEqual(fixture('uploadAttachment'));
		const form = calls.at(-1)?.init?.body as FormData;
		expect((form.get('file') as File).name).toBe('notes.txt');
		expect(await repos.drafts.send({ draft })).toEqual(fixture('send'));
		expect(await repos.drafts.cancelSend('m1')).toEqual(fixture('cancelSend'));
	});

	it('contacts, settings, and search', async () => {
		const { repos, calls } = await signedIn();
		expect(await repos.contacts.search({ q: 'bo' })).toEqual(fixture('listContacts'));
		expect(await repos.settings.get()).toEqual(fixture('getSettings'));
		expect(await repos.settings.save(fixture('getSettings'))).toEqual(fixture('putSettings'));
		expect(await repos.search.search({ q: 'notes', semantic: true })).toEqual(fixture('search'));
		expect(fetchUrl(calls, 'search')).toBe(`${BASE}/search?q=notes&semantic=true`);
	});

	it('ai: summary, replies, assistant, and feedback', async () => {
		const { repos } = await signedIn();
		expect(await repos.ai.summary('t1')).toEqual(fixture('aiSummary'));
		expect(await repos.ai.replies('t1')).toEqual(fixture('aiReplies'));
		expect(await repos.ai.assistant({ prompt: 'catch me up' })).toEqual(fixture('aiAssistant'));
		await expect(repos.ai.feedback({ type: 'open', threadId: 't1' })).resolves.toBeUndefined();
	});

	it('reports the server error envelope as an AppError', async () => {
		const { repos } = setup((name) =>
			name === 'getThread' ? Response.json(fixture('error.notFound'), { status: 404 }) : undefined
		);
		await expect(repos.mail.get('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});
});

/** The URL of the latest request to an endpoint. */
function fetchUrl(calls: Call[], name: EndpointName): string | undefined {
	return calls.findLast((c) => c.name === name)?.url;
}
