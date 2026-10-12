import { CATEGORIES, type Category } from '@nem/shared';
import type { ModelSpec } from '../registry.js';

/** How each tab is described to the zero-shot model (natural-language inference). */
const DESCRIPTIONS: Record<Category, string> = {
	primary: 'a personal message from someone the reader knows',
	promotions: 'a marketing email with a sale, discount or offer',
	social: 'a notification from a social network',
	updates: 'a receipt, order, bill, account or appointment notice',
	forums: 'a message from a mailing list or discussion forum'
};

export interface ZeroShotResult {
	category: Category;
	score: number;
}

type Classify = (text: string) => Promise<ZeroShotResult>;

let loading: Promise<Classify> | undefined;

/**
 * Zero-shot classification with MobileBERT MNLI through Transformers.js (Apache-2.0).
 * Only called once the user has downloaded the model (AI settings), so it reads the
 * Cache API files and needs no network. Transformers.js is imported on first use, so
 * it is never loaded for users who skip the download.
 */
export function zeroShotClassifier(spec: ModelSpec): Promise<Classify> {
	loading ??= (async () => {
		const { env, pipeline } = await import('@huggingface/transformers');
		env.allowLocalModels = false;
		env.useBrowserCache = true;
		const classifier = await pipeline('zero-shot-classification', spec.repo, { dtype: 'q8' });
		const labels = CATEGORIES.map((category) => DESCRIPTIONS[category]);
		return async (text: string) => {
			const output = await classifier(text, labels, {
				hypothesis_template: 'This email is {}.'
			});
			const result = Array.isArray(output) ? output[0] : output;
			const best = result?.labels[0];
			const category = CATEGORIES.find((c) => DESCRIPTIONS[c] === best) ?? 'primary';
			return { category, score: result?.scores[0] ?? 0 };
		};
	})().catch((error: unknown) => {
		loading = undefined;
		throw error;
	});
	return loading;
}
