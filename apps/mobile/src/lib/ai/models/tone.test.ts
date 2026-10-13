import { describe, expect, it } from 'vitest';
import { createWorkerApi } from '../worker/api.js';
import type { StorageEnv } from '../storage.js';
import { checkTone, lexiconTone } from './tone.js';

describe('tone check', () => {
	it('flags hostile wording and names what stood out', () => {
		const verdict = checkTone('This is ridiculous. What were you thinking?');
		expect(verdict?.value.isHarsh).toBe(true);
		expect(verdict?.value.reasons).toEqual(['ridiculous', '“what were you thinking”']);
		expect(verdict?.source).toBe('heuristic');
		expect(verdict?.explanation).toMatch(/ridiculous/);
	});

	it('counts shouting and !!!, and leaves polite or plain mail alone', () => {
		expect(lexiconTone('Send the FILES NOW!!!').isHarsh).toBe(true);
		expect(checkTone("Sorry, I can't make Friday. Could we do Monday?")?.value.isHarsh).toBe(false);
		expect(checkTone('Thanks so much, this is really helpful!')?.value.score).toBeGreaterThan(0);
		expect(checkTone('   ')).toBeNull();
	});

	it('handles negation and intensifiers', () => {
		expect(lexiconTone('Not bad at all').score).toBeGreaterThan(0);
		expect(lexiconTone('This is not helpful').score).toBeLessThan(0);
		expect(lexiconTone('really awful').score).toBeLessThan(lexiconTone('awful').score);
	});

	it('lets a sure model flag mild wording, but not plain bad news', () => {
		const negative = { label: 'NEGATIVE' as const, score: 0.99 };
		const mild = checkTone('The draft is wrong and the numbers are off.', negative);
		expect(mild?.value.isHarsh).toBe(true);
		expect(mild?.source).toBe('model');
		expect(checkTone("I can't make it on Friday.", negative)?.value.isHarsh).toBe(false);
	});

	it('uses the sentiment model in the worker only when it is downloaded', async () => {
		const cache = { match: async () => new Response('x') };
		const env = { caches: { open: async () => cache } } as unknown as StorageEnv;
		const store = { get: async () => undefined, put: async () => {} };
		const sentiment = async () => async () => ({ label: 'NEGATIVE' as const, score: 0.99 });
		const api = createWorkerApi(env, () => [], undefined, store, undefined, undefined, sentiment);
		expect((await api.checkTone('The numbers are wrong.'))?.source).toBe('model');
		const none = { caches: { open: async () => ({ match: async () => undefined }) } };
		const plain = createWorkerApi(none as unknown as StorageEnv, () => [], undefined, store);
		expect((await plain.checkTone('The numbers are wrong.'))?.source).toBe('heuristic');
	});
});
