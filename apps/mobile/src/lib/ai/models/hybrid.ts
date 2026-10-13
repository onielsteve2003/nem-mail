/** One thread to embed for semantic search: its id and the text that stands for it. */
export interface SemanticDoc {
	id: string;
	text: string;
}

/** MiniLM cosine below this is noise for short email texts. */
export const SEMANTIC_MIN = 0.3;
/** How much the keyword rank counts against meaning in the blend. */
export const KEYWORD_WEIGHT = 0.5;
export const MAX_RESULTS = 50;

/** FNV-1a, enough to notice that a thread's text changed since it was embedded. */
export function textHash(text: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
}

/** Dot product; vectors are unit length, so this is the cosine similarity. */
export function dot(a: readonly number[], b: readonly number[]): number {
	let sum = 0;
	for (let i = 0; i < Math.min(a.length, b.length); i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
	return sum;
}

/**
 * Hybrid ranking for AI-7: keyword hits keep a share of their BM25 order (1 for the
 * first down to 0.5 for the last), every candidate adds its meaning similarity, and
 * threads with no keyword match get in on meaning alone when `allowNew` is set.
 */
export function hybridRank(
	keywordIds: readonly string[],
	similarity: Readonly<Record<string, number>>,
	allowNew: boolean
): string[] {
	const scores = new Map<string, number>();
	const count = keywordIds.length;
	keywordIds.forEach((id, i) => {
		const keyword = 1 - (0.5 * i) / Math.max(count - 1, 1);
		scores.set(
			id,
			KEYWORD_WEIGHT * keyword + (1 - KEYWORD_WEIGHT) * Math.max(similarity[id] ?? 0, 0)
		);
	});
	if (allowNew) {
		for (const [id, sim] of Object.entries(similarity)) {
			if (!scores.has(id) && sim >= SEMANTIC_MIN) scores.set(id, (1 - KEYWORD_WEIGHT) * sim);
		}
	}
	return [...scores.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, MAX_RESULTS)
		.map(([id]) => id);
}
