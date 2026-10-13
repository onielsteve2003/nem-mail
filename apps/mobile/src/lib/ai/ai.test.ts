import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { detectBackend } from './backend.js';
import { findModel, MODELS, modelFileUrls } from './registry.js';
import { AIService } from './service.svelte.js';
import { downloadModel, isModelCached, type StorageEnv } from './storage.js';
import { createWorkerApi } from './worker/api.js';

/** A Cache API stand-in keyed by URL. */
function fakeEnv(failUrl?: string) {
	const store = new Map<string, Response>();
	const cache = {
		match: async (url: string) => store.get(url)?.clone(),
		put: async (url: string, response: Response) => void store.set(url, response),
		delete: async (url: string) => store.delete(url)
	};
	const fetch = vi.fn(async (url: string) => {
		if (url === failUrl) return new Response(null, { status: 503 });
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array(6));
				controller.enqueue(new Uint8Array(4));
				controller.close();
			}
		});
		return new Response(body, { headers: { 'content-length': '10' } });
	});
	const env = { caches: { open: async () => cache }, fetch } as unknown as StorageEnv;
	return { env, store, fetch };
}

const minilm = findModel('minilm')!;

describe('model storage', () => {
	it('downloads every file with progress and skips cached files next time', async () => {
		const { env, store, fetch } = fakeEnv();
		const progress: number[] = [];
		await downloadModel(minilm, env, ({ loaded, total }) => progress.push(loaded / total));
		expect([...store.keys()]).toEqual(modelFileUrls(minilm));
		expect(progress.at(-1)).toBe(1);
		expect(progress).toEqual([...progress].sort((a, b) => a - b));
		expect(await isModelCached(minilm, env)).toBe(true);

		await downloadModel(minilm, env);
		expect(fetch).toHaveBeenCalledTimes(minilm.files.length);
	});

	it('throws on a failed file and keeps the ones before it', async () => {
		const urls = modelFileUrls(minilm);
		const { env, store } = fakeEnv(urls[2]);
		await expect(downloadModel(minilm, env)).rejects.toThrow(/MiniLM/);
		expect(store.size).toBe(2);
		expect(await isModelCached(minilm, env)).toBe(false);
	});
});

describe('detectBackend', () => {
	it('prefers WebGPU only when an adapter is granted', async () => {
		const adapter = { requestAdapter: async () => ({}) };
		expect(await detectBackend({ gpu: adapter }, true)).toBe('webgpu');
		expect(await detectBackend({ gpu: { requestAdapter: async () => null } }, true)).toBe('wasm');
		expect(await detectBackend({}, false)).toBe('none');
	});
});

describe('AIService', () => {
	function setup(failUrl?: string) {
		const { env } = fakeEnv(failUrl);
		const ids = () => MODELS.map((model) => model.id);
		const api = createWorkerApi(env, ids, async () => 'wasm');
		const connect = vi.fn(async () => ({ api, terminate: vi.fn() }));
		const settings = { get: vi.fn(), save: vi.fn() };
		return { service: new AIService(settings, connect), connect, settings };
	}

	it('starts the worker lazily, once', async () => {
		const { service, connect } = setup();
		expect(connect).not.toHaveBeenCalled();
		await service.refresh();
		await service.refresh();
		expect(connect).toHaveBeenCalledTimes(1);
		expect(service.backend).toBe('wasm');
		expect(service.models['minilm']?.status).toBe('absent');
	});

	it('downloads, reports ready, and removes a model', async () => {
		const { service } = setup();
		const download = service.download('minilm');
		flushSync();
		expect(service.models['minilm']?.status).toBe('downloading');
		await download;
		expect(service.models['minilm']).toEqual({ status: 'ready', progress: 1, error: null });
		await service.refresh();
		expect(service.models['minilm']?.status).toBe('ready');
		await service.remove('minilm');
		expect(service.models['minilm']?.status).toBe('absent');
	});

	it('puts a failed download into the model state', async () => {
		const { service } = setup(modelFileUrls(minilm)[0]);
		await service.download('minilm');
		expect(service.models['minilm']?.status).toBe('error');
		expect(service.models['minilm']?.error).toMatch(/try again/);
	});

	it('reads feature flags from settings and keeps defaults on failure', async () => {
		const { service, settings } = setup();
		expect(service.isEnabled('spam')).toBe(true);
		settings.get.mockResolvedValueOnce({ ai: { ...service.toggles, spam: false } });
		await service.loadToggles();
		expect(service.isEnabled('spam')).toBe(false);
		settings.get.mockRejectedValueOnce(new Error('blocked'));
		await service.loadToggles();
		expect(service.isEnabled('spam')).toBe(false);
	});
});

describe('category zero-shot upgrade', () => {
	const memory = () => {
		const saved = new Map<string, unknown>();
		return { get: async (key: string) => saved.get(key), put: async () => {} };
	};
	const vague = { fromEmail: 'x@y.example', subject: 'Hello', bodyText: 'Zzz qqq.' };

	it('asks the zero-shot model only when it is downloaded and the model is unsure', async () => {
		const { env } = fakeEnv();
		const zeroShot = vi.fn(async () => ({ category: 'social' as const, score: 0.82 }));
		const api = createWorkerApi(
			env,
			() => [],
			async () => 'wasm',
			memory(),
			async () => zeroShot
		);
		const [before] = await api.classifyCategory('u1', [vague]);
		expect(zeroShot).not.toHaveBeenCalled();
		expect(before!.confidence).toBeLessThan(0.6);

		await api.download('mobilebert-mnli');
		const [after] = await api.classifyCategory('u1', [vague]);
		expect(after).toMatchObject({ value: 'social', confidence: 0.82, source: 'model' });
		expect(after!.explanation).toContain('language model');
		// Confident rule answers never wait for the transformer.
		await api.classifyCategory('u1', [{ ...vague, subject: '[club] Meeting' }]);
		expect(zeroShot).toHaveBeenCalledOnce();
	});
});

describe('thread summary', () => {
	const memory = { get: async () => undefined, put: async () => {} };
	const messages = [
		{
			from: 'Ada',
			text: 'The launch moves to Thursday. The audit needs two more days of testing. Can you send the test results by Wednesday?'
		}
	];

	it('uses TextRank, and DistilBART once it is downloaded', async () => {
		const { env } = fakeEnv();
		const summarize = vi.fn(async () => 'Launch slips to Thursday for the audit.');
		const api = createWorkerApi(
			env,
			() => [],
			async () => 'wasm',
			memory,
			undefined,
			async () => summarize
		);
		const extractive = await api.summarize(messages);
		expect(extractive?.explanation).toContain('TextRank');
		expect(summarize).not.toHaveBeenCalled();

		await api.download('distilbart-cnn');
		const written = await api.summarize(messages);
		expect(written?.value.text).toBe('Launch slips to Thursday for the audit.');
		expect(written?.value.actionItems).toEqual(extractive?.value.actionItems);
		expect(written?.explanation).toContain('DistilBART');
	});
});
