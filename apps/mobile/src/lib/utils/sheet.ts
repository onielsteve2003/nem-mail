/** A fling is projected this far ahead (ms) to pick where the sheet lands. */
export const SHEET_PROJECTION_MS = 160;
/** Dragging below the lowest snap by this share of the visible sheet dismisses it. */
export const SHEET_DISMISS_FRACTION = 0.35;

/**
 * Pixel offsets of each snap point, measured down from the fully open sheet.
 * `points` are viewport-height fractions in ascending order; none means one
 * content-sized position.
 */
export function snapOffsets(points: readonly number[], viewportHeight: number): number[] {
	if (points.length === 0) return [0];
	const max = Math.max(...points);
	return points.map((point) => (max - point) * viewportHeight);
}

interface ResolveSnapInput {
	/** Current offset from the fully open position, in px. */
	position: number;
	/** Drag velocity in px/ms; positive is downward. */
	velocity: number;
	offsets: readonly number[];
	/** Full sheet height in px. */
	sheetHeight: number;
}

/** Index of the snap point a released drag settles on, or -1 to dismiss. */
export function resolveSnap({
	position,
	velocity,
	offsets,
	sheetHeight
}: ResolveSnapInput): number {
	const projected = position + velocity * SHEET_PROJECTION_MS;
	const lowest = Math.max(...offsets);
	const visible = Math.max(sheetHeight - lowest, 0);
	if (projected > lowest + visible * SHEET_DISMISS_FRACTION) return -1;

	let best = 0;
	offsets.forEach((offset, index) => {
		if (Math.abs(offset - projected) < Math.abs((offsets[best] ?? 0) - projected)) best = index;
	});
	return best;
}
