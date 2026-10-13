import type { ModelSpec } from '../registry.js';
import type { Sentiment } from './tone.js';

export type ClassifySentiment = (text: string) => Promise<Sentiment>;

/** SST-2 was trained on single sentences; a long email is cut to its first part. */
const MAX_INPUT_CHARS = 1500;

let loading: Promise<ClassifySentiment> | undefined;

/**
 * Sentiment with DistilBERT SST-2 through Transformers.js (Apache-2.0). Only called once
 * the user has downloaded the model (AI settings), so it reads the Cache API files and
 * needs no network. Transformers.js loads on first use.
 */
export function sentimentClassifier(spec: ModelSpec): Promise<ClassifySentiment> {
	loading ??= (async () => {
		const { env, pipeline } = await import('@huggingface/transformers');
		env.allowLocalModels = false;
		env.useBrowserCache = true;
		const classifier = await pipeline('sentiment-analysis', spec.repo, { dtype: 'q8' });
		return async (text: string): Promise<Sentiment> => {
			const output = await classifier(text.slice(0, MAX_INPUT_CHARS));
			const first = (Array.isArray(output) ? output[0] : output) as
				{ label?: string; score?: number } | undefined;
			return {
				label: first?.label === 'NEGATIVE' ? 'NEGATIVE' : 'POSITIVE',
				score: first?.score ?? 0
			};
		};
	})().catch((error: unknown) => {
		loading = undefined;
		throw error;
	});
	return loading;
}
