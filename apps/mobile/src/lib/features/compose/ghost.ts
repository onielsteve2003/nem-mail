/** Smart compose waits for a short pause in typing before it asks the model (AI-5). */
export const SUGGEST_DELAY_MS = 120;
/** A sideways swipe at least this long, and mostly horizontal, accepts the ghost text. */
export const ACCEPT_SWIPE_PX = 48;

const BLOCKS = new Set(['DIV', 'P', 'LI', 'BLOCKQUOTE']);

/** Where the ghost text is drawn, relative to the editor's wrapper. */
export interface GhostPlace {
	top: number;
	/** How far into the line the caret sits, used as the overlay's text-indent. */
	indent: number;
}

/** The paragraph-level element the caret is in, or the editor itself. */
export function caretBlock(node: Node, root: HTMLElement): HTMLElement {
	let current: Node | null = node;
	while (current && current !== root) {
		if (current instanceof HTMLElement && BLOCKS.has(current.tagName)) return current;
		current = current.parentNode;
	}
	return root;
}

/**
 * The text of the caret's paragraph up to the caret, when the caret is collapsed at the
 * end of that paragraph (ghost text only makes sense with nothing after it). Else null.
 */
export function caretText(root: HTMLElement): { before: string; caret: Range } | null {
	const selection = document.getSelection();
	if (!selection?.rangeCount || !selection.isCollapsed) return null;
	const caret = selection.getRangeAt(0);
	if (!root.contains(caret.startContainer)) return null;
	const block = caretBlock(caret.startContainer, root);
	const after = document.createRange();
	after.selectNodeContents(block);
	after.setStart(caret.startContainer, caret.startOffset);
	if (after.toString().trim()) return null;
	const before = document.createRange();
	before.selectNodeContents(block);
	before.setEnd(caret.startContainer, caret.startOffset);
	return { before: before.toString(), caret };
}

/** Places the ghost text at the caret; null when the browser gives the caret no box. */
export function ghostPlace(caret: Range, wrapper: Element, editor: HTMLElement): GhostPlace | null {
	const rect = caret.getBoundingClientRect?.();
	if (!rect?.height) return null;
	const box = wrapper.getBoundingClientRect();
	const content = editor.getBoundingClientRect();
	const padding = parseFloat(getComputedStyle(editor).paddingInlineStart) || 0;
	return { top: rect.top - box.top, indent: Math.max(0, rect.left - content.left - padding) };
}

/** True for a touch that moved right far enough, and more sideways than up or down. */
export function isAcceptSwipe(dx: number, dy: number): boolean {
	return dx >= ACCEPT_SWIPE_PX && Math.abs(dy) * 2 < dx;
}
