export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

/** A screen point, e.g. where a long-press happened. */
export interface Point {
	x: number;
	y: number;
}

export interface AnchorRect {
	top: number;
	bottom: number;
	left: number;
	right: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface PopoverPosition {
	top: number;
	left: number;
	/** The placement actually used, after flipping to fit the viewport. */
	placement: PopoverPlacement;
}

/** Space between the anchor and the panel, in px. */
export const POPOVER_GAP = 8;
/** Minimum distance between the panel and the viewport edge, in px. */
export const POPOVER_MARGIN = 8;

export function pointToRect({ x, y }: Point): AnchorRect {
	return { top: y, bottom: y, left: x, right: x };
}

/**
 * Places a panel next to its anchor. Flips to the other side when the
 * preferred side has no room and the other side has more, then keeps the
 * panel inside the viewport horizontally.
 */
export function placePopover(
	anchor: AnchorRect,
	panel: Size,
	viewport: Size,
	placement: PopoverPlacement = 'bottom-start'
): PopoverPosition {
	const [side, align] = placement.split('-') as ['top' | 'bottom', 'start' | 'end'];
	const spaceBelow = viewport.height - anchor.bottom - POPOVER_GAP - POPOVER_MARGIN;
	const spaceAbove = anchor.top - POPOVER_GAP - POPOVER_MARGIN;

	let finalSide = side;
	if (side === 'bottom' && panel.height > spaceBelow && spaceAbove > spaceBelow) finalSide = 'top';
	if (side === 'top' && panel.height > spaceAbove && spaceBelow > spaceAbove) finalSide = 'bottom';

	const rawTop =
		finalSide === 'bottom' ? anchor.bottom + POPOVER_GAP : anchor.top - POPOVER_GAP - panel.height;
	const rawLeft = align === 'start' ? anchor.left : anchor.right - panel.width;

	return {
		top: clamp(rawTop, POPOVER_MARGIN, viewport.height - panel.height - POPOVER_MARGIN),
		left: clamp(rawLeft, POPOVER_MARGIN, viewport.width - panel.width - POPOVER_MARGIN),
		placement: `${finalSide}-${align}`
	};
}

/** Like Math.min(Math.max(...)), but `min` wins when the panel is larger than the space. */
function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}
