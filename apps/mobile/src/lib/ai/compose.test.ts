import { describe, expect, it, vi } from 'vitest';
import type { MailRepository } from '#lib/data/repositories.js';
import type { ModelStore } from './model-store.js';
import { AIService } from './service.svelte.js';
import { createWorkerApi } from './worker/api.js';
import type { StorageEnv } from './storage.js';

const USER = { id: 'u1', email: 'me@nem.mail' };

function memoryStore(): ModelStore & { data: Map<string, unknown> } {
	const data = new Map<string, unknown>();
	return {
		data,
		get: async (key) => structuredClone(data.get(key)),
		put: async (key, value) => void data.set(key, structuredClone(value))
	};
}

function setup(store = memoryStore()) {
	const api = createWorkerApi(
		{} as StorageEnv,
		() => [],
		async () => 'wasm',
		store
	);
	const sent = (id: string, from: string, bodyText: string) => ({
		id,
		from: { email: from },
		bodyText
	});
	const mail = {
		list: vi.fn(async () => ({ items: [{ id: 't1' }], nextCursor: null })),
		get: vi.fn(async () => ({
			id: 't1',
			messages: [
				sent('m1', 'other@x.com', 'The quarterly numbers are wrong.'),
				sent('m2', 'ME@nem.mail', 'The quarterly numbers look solid.\n-- \nMe')
			]
		}))
	} as unknown as MailRepository;
	const connect = async () => ({ api, terminate() {} });
	return { service: new AIService(null, connect, null, mail), mail, store };
}

describe('smart compose in AIService', () => {
	it("trains once on the user's own sent mail, then suggests their phrasing", async () => {
		const { service, mail, store } = setup();
		const verdict = await service.complete(USER, 'Sending the quarterly ');
		expect(verdict?.value).toBe('numbers look solid.');
		expect(store.data.has('u1:ngram')).toBe(true);
		await service.complete(USER, 'Thanks for the ');
		expect(mail.list).toHaveBeenCalledTimes(1);
	});

	it('skips sent mail when a saved model exists, and learns from new sends', async () => {
		const first = setup();
		await first.service.learnCompose('u1', 'Our offsite agenda is attached.');
		const { service, mail } = setup(first.store);
		expect((await service.complete(USER, 'Our offsite '))?.value).toBe('agenda is attached.');
		expect(mail.list).not.toHaveBeenCalled();
	});

	it('returns nothing when smart compose is off', async () => {
		const { service, mail } = setup();
		service.toggles.smartCompose = false;
		expect(await service.complete(USER, 'Let me know if you have any ')).toBeNull();
		expect(mail.list).not.toHaveBeenCalled();
	});
});
