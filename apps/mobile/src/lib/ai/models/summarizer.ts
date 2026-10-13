import type { ModelSpec } from '../registry.js';

export type Summarize = (text: string) => Promise<string>;

/** DistilBART reads at most 1024 tokens; this many characters stays well inside that. */
const MAX_INPUT_CHARS = 3000;
const MAX_SUMMARY_TOKENS = 80;

let loading: Promise<Summarize> | undefined;

/**
 * Abstractive summaries with DistilBART CNN 6-6 through Transformers.js (Apache-2.0).
 * Only called once the user has downloaded the model (AI settings), so it reads the
 * Cache API files and needs no network. Transformers.js loads on first use.
 */
export function abstractiveSummarizer(spec: ModelSpec): Promise<Summarize> {
	loading ??= (async () => {
		const { env, pipeline } = await import('@huggingface/transformers');
		env.allowLocalModels = false;
		env.useBrowserCache = true;
		const summarizer = await pipeline('summarization', spec.repo, { dtype: 'q8' });
		return async (text: string) => {
			const output = await summarizer(text.slice(0, MAX_INPUT_CHARS), {
				max_new_tokens: MAX_SUMMARY_TOKENS
			});
			const first = Array.isArray(output) ? output[0] : output;
			return ((first as { summary_text?: string } | undefined)?.summary_text ?? '').trim();
		};
	})().catch((error: unknown) => {
		loading = undefined;
		throw error;
	});
	return loading;
}
