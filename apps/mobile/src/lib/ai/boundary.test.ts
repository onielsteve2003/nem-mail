import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIService } from './service.svelte.js';
import type { AIWorkerApi } from './worker/api.js';

vi.mock('comlink', () => ({
	wrap: vi.fn(() => new Proxy({}, { get: () => vi.fn(async () => 'remote') })),
	proxy: vi.fn((callback: unknown) => callback)
}));

const SRC = join(import.meta.dirname, '..', '..');

/** Every non-test source file the main thread can load. */
function mainThreadFiles(): string[] {
	return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
		.map((file) => relative(SRC, join(SRC, file)).split(sep).join('/'))
		.filter((file) => /\.(ts|svelte)$/.test(file) && !/\.test\.ts$/.test(file))
		.filter((file) => !file.startsWith('lib/ai/worker/') && !file.startsWith('lib/ai/models/'));
}

/** Value (not type-only) imports in a file. */
function valueImports(source: string): string[] {
	return [...source.matchAll(/^\s*import\s+(?!type\s)[^;]*?from\s+'([^']+)'/gm)].map(
		(match) => match[1]!
	);
}

/** Model modules that pull in Transformers.js, which must only ever load in the worker. */
const HEAVY =
	/(@huggingface\/transformers|models\/(embedder|sentiment|summarizer|zero-shot)(\.js)?$)/;

describe('main thread stays free', () => {
	it('no main-thread file statically imports Transformers.js, the worker or Comlink', () => {
		const offenders = mainThreadFiles().flatMap((file) =>
			valueImports(readFileSync(join(SRC, file), 'utf8'))
				.filter((spec) => HEAVY.test(spec) || /worker\/connect|^comlink$/.test(spec))
				.map((spec) => `${file} -> ${spec}`)
		);
		expect(offenders).toEqual([]);
	});

	it('AIService hands work to the worker and returns before it answers', async () => {
		let answer!: (value: unknown) => void;
		const api = new Proxy({} as AIWorkerApi, {
			get: () => () => new Promise((resolve) => (answer = resolve))
		});
		const service = new AIService(null, async () => ({ api, terminate: vi.fn() }));

		const start = performance.now();
		let settled = false;
		const pending = service.checkTone('You never reply.').then(() => (settled = true));
		expect(performance.now() - start).toBeLessThan(16);

		// The main thread keeps running other work while the worker is busy.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(settled).toBe(false);

		answer({ value: 'neutral', confidence: 0.6, explanation: 'Calm wording.', source: 'rules' });
		await pending;
		expect(settled).toBe(true);
	});
});

describe('connectWorker', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('starts one named module worker and terminates it', async () => {
		const terminate = vi.fn();
		const Worker = vi.fn(function (this: Record<string, unknown>) {
			this.terminate = terminate;
		});
		vi.stubGlobal('Worker', Worker);
		const { connectWorker } = await import('./worker/connect.js');

		const connection = connectWorker();
		expect(Worker).toHaveBeenCalledOnce();
		expect(Worker).toHaveBeenCalledWith(expect.any(URL), { type: 'module', name: 'nem-ai' });
		expect(await connection.api.backend()).toBe('remote');

		connection.terminate();
		expect(terminate).toHaveBeenCalledOnce();
	});
});
