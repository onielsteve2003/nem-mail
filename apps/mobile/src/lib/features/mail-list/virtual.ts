/** Lists longer than this render only the rows near the viewport (code standards §8). */
export const VIRTUALIZE_ABOVE = 200;
/** Height a row is assumed to have until it has been measured. */
export const ROW_ESTIMATE_PX = 88;
/** Rows this far above and below the viewport stay rendered, so fast scrolls do not show gaps. */
export const OVERSCAN_PX = 800;

/** The rows to render, `[start, end)`, and the space the skipped rows take above and below. */
export interface VirtualRange {
	start: number;
	end: number;
	before: number;
	after: number;
}

/**
 * Picks the rows that meet the viewport plus overscan.
 * @param heights height of every row, measured or estimated
 * @param top how far the viewport's top is below the first row's top
 * @param viewport the viewport's height
 */
export function virtualRange(
	heights: readonly number[],
	top: number,
	viewport: number,
	overscan = OVERSCAN_PX
): VirtualRange {
	const from = top - overscan;
	const to = top + viewport + overscan;
	let start = 0;
	let y = 0;
	while (start < heights.length && y + (heights[start] ?? 0) <= from) {
		y += heights[start] ?? 0;
		start++;
	}
	const before = y;
	let end = start;
	while (end < heights.length && y < to) {
		y += heights[end] ?? 0;
		end++;
	}
	let after = 0;
	for (let index = end; index < heights.length; index++) after += heights[index] ?? 0;
	return { start, end, before, after };
}

/** The mean of the measured heights, or the estimate before any row is measured. */
export function rowEstimate(measured: readonly number[]): number {
	if (measured.length === 0) return ROW_ESTIMATE_PX;
	return measured.reduce((sum, height) => sum + height, 0) / measured.length;
}
