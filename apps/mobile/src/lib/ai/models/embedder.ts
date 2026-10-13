import type { ModelSpec } from '../registry.js';

/** Unit-length sentence vectors, one per text. */
export type Embed = (texts: string[]) => Promise<number[][]>;

let loading: Promise<Embed> | undefined;

/**
 * Sentence embeddings with all-MiniLM-L6-v2 through Transformers.js (Apache-2.0):
 * mean pooling and L2 normalization, so a dot product is the cosine similarity. Only
 * called once the user has downloaded the model, so it reads the Cache API files.
 */
export function sentenceEmbedder(spec: ModelSpec): Promise<Embed> {
	loading ??= (async () => {
		const { env, pipeline } = await import('@huggingface/transformers');
		env.allowLocalModels = false;
		env.useBrowserCache = true;
		const extractor = await pipeline('feature-extraction', spec.repo, { dtype: 'q8' });
		return async (texts: string[]) => {
			const output = await extractor(texts, { pooling: 'mean', normalize: true });
			return output.tolist() as number[][];
		};
	})().catch((error: unknown) => {
		loading = undefined;
		throw error;
	});
	return loading;
}
