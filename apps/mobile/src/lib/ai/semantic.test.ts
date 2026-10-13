import { describe, expect, it, vi } from 'vitest';
import type { MailRepository } from '#lib/data/repositories.js';
import type { EmbeddingEntry, EmbeddingStore } from './model-store.js';
import { hybridRank, textHash } from './models/hybrid.js';
import { AIService } from './service.svelte.js';
import type { StorageEnv } from './storage.js';
import { createWorkerApi } from './worker/api.js';

/** A toy embedder: one axis per topic word, unit length. */
const TOPICS = ['flight', 'invoice', 'party'];
const SYNONYMS: Record<string, string> = { boarding: 'flight', plane: 'flight', bill: 'invoice' };
function toyEmbed(text: string): number[] {
	const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
	const v = TOPICS.map((t) => (words.some((w) => w === t || SYNONYMS[w] === t) ? 1 : 0));
	const norm = Math.hypot(...v) || 1;
	return v.map((x) => x / norm);
}

function memoryEmbeddings(): EmbeddingStore & { data: Map<string, EmbeddingEntry> } {
	const data = new Map<string, EmbeddingEntry>();
	return {
		data,
		getMany: async (keys) => keys.map((k) => data.get(k)),
		putMany: async (entries) => entries.forEach(([k, e]) => data.set(k, e))
	};
}

function setup(isCached = true) {
	const cache = { match: async () => (isCached ? new Response('x') : undefined) };
	const env = { caches: { open: async () => cache } } as unknown as StorageEnv;
	const store = memoryEmbeddings();
	const embed = vi.fn(async (texts: string[]) => texts.map(toyEmbed));
	const models = { get: async () => undefined, put: async () => {} };
	const api = createWorkerApi(env, () => [], undefined, models, undefined, undefined, undefined, {
		store,
		embed: async () => embed
	});
	return { api, store, embed };
}

const thread = (id: string, subject: string) => ({ id, subject, snippet: '' }) as never;

describe('semantic search', () => {
	it('blends keyword order with meaning and lets meaning-only matches in when allowed', () => {
		const sims = { a: 0.1, b: 0.9, c: 0.8, d: 0.1 };
		expect(hybridRank(['a', 'b'], sims, false)).toEqual(['b', 'a']);
		expect(hybridRank(['a', 'b'], sims, true)).toEqual(['b', 'a', 'c']);
		expect(textHash('a')).not.toBe(textHash('b'));
	});

	it('caches vectors per thread and recomputes only changed text', async () => {
		const { api, store, embed } = setup();
		const docs = [
			{ id: 't1', text: 'Your boarding pass' },
			{ id: 't2', text: 'Invoice for March' }
		];
		const scores = await api.semanticScores('u1', 'flight', docs);
		expect(scores?.['t1']).toBeCloseTo(1);
		expect(scores?.['t2']).toBe(0);
		expect(store.data.has('u1:t1')).toBe(true);
		embed.mockClear();
		await api.semanticScores('u1', 'flight', [docs[0]!, { id: 't2', text: 'Party on Friday' }]);
		// One batch for the changed thread, one for the query.
		expect(embed.mock.calls.map(([texts]) => texts)).toEqual([['Party on Friday'], ['flight']]);
	});

	it('returns null without the model, so search stays keyword-only', async () => {
		const { api } = setup(false);
		expect(await api.semanticScores('u1', 'flight', [{ id: 't1', text: 'plane' }])).toBeNull();
	});

	it('finds mail by meaning across All Mail in AIService', async () => {
		const { api } = setup();
		const mail = {
			list: vi.fn(async () => ({
				items: [thread('t1', 'Your boarding pass'), thread('t2', 'March bill'), thread('t3', 'Hi')],
				nextCursor: null
			}))
		} as unknown as MailRepository;
		const service = new AIService(null, async () => ({ api, terminate() {} }), null, mail);
		const found = await service.semanticSearch('u1', 'flight', [], true);
		expect(found?.map((t) => t.id)).toEqual(['t1']);
		const reranked = await service.semanticSearch('u1', 'invoice', [thread('t3', 'Hi')], false);
		expect(reranked?.map((t) => t.id)).toEqual(['t3']);
		expect(mail.list).toHaveBeenCalledTimes(1);
		service.toggles.semanticSearch = false;
		expect(await service.semanticSearch('u1', 'flight', [], true)).toBeNull();
	});
});
