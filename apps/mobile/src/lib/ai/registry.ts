import type { AIFeature } from '@nem/shared';

/** Where optional models are downloaded from. Files are public and free to use. */
export const MODEL_HOST = 'https://huggingface.co';

/**
 * Cache API bucket for model files. It is the bucket Transformers.js reads from in the
 * browser, keyed by the same URLs, so a model downloaded here needs no second download.
 */
export const MODEL_CACHE = 'transformers-cache';

/** An optional on-device transformer model. Classic models (NB, LogReg, n-gram) need none. */
export interface ModelSpec {
	id: string;
	/** Hugging Face repository, e.g. `Xenova/all-MiniLM-L6-v2`. */
	repo: string;
	name: string;
	/** What the model does, in plain words, for the model manager. */
	purpose: string;
	/** The AI features that can use it. */
	features: AIFeature[];
	/** Approximate download size; the real size comes from the server while downloading. */
	sizeBytes: number;
	license: string;
	/** Files inside the repository, relative to its root. */
	files: string[];
}

const ONNX_FILES = [
	'config.json',
	'tokenizer.json',
	'tokenizer_config.json',
	'onnx/model_quantized.onnx'
];

/**
 * Every optional model, all quantized ONNX and under 100 MB (PRD constraints).
 * Later tasks add theirs here (e.g. the summarizer in T10.8).
 */
export const MODELS: readonly ModelSpec[] = [
	{
		// all-MiniLM-L6-v2, ~23 MB quantized, Apache-2.0.
		id: 'minilm',
		repo: 'Xenova/all-MiniLM-L6-v2',
		name: 'MiniLM L6 v2',
		purpose: 'Sentence embeddings for semantic search',
		features: ['semanticSearch'],
		sizeBytes: 23_000_000,
		license: 'Apache-2.0',
		files: ONNX_FILES
	},
	{
		// DistilBERT fine-tuned on SST-2, ~67 MB quantized, Apache-2.0.
		id: 'distilbert-sst2',
		repo: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
		name: 'DistilBERT SST-2',
		purpose: 'Sentiment for the tone check before sending',
		features: ['toneCheck'],
		sizeBytes: 67_000_000,
		license: 'Apache-2.0',
		files: ONNX_FILES
	},
	{
		// MobileBERT fine-tuned on MNLI, ~25 MB quantized, Apache-2.0.
		id: 'mobilebert-mnli',
		repo: 'Xenova/mobilebert-uncased-mnli',
		name: 'MobileBERT MNLI',
		purpose: 'Zero-shot classification for inbox categories',
		features: ['categories'],
		sizeBytes: 25_000_000,
		license: 'Apache-2.0',
		files: ONNX_FILES
	}
];

/** The model with this ID, or undefined. */
export function findModel(id: string): ModelSpec | undefined {
	return MODELS.find((model) => model.id === id);
}

/** Full download URLs of a model's files. */
export function modelFileUrls(model: ModelSpec): string[] {
	return model.files.map((file) => `${MODEL_HOST}/${model.repo}/resolve/main/${file}`);
}
