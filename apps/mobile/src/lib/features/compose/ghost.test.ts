import { afterEach, describe, expect, it } from 'vitest';
import { ownBodyText } from './body.js';
import { caretText, isAcceptSwipe } from './ghost.js';

function placeCaret(node: Node, offset: number) {
	const range = document.createRange();
	range.setStart(node, offset);
	range.collapse(true);
	document.getSelection()?.removeAllRanges();
	document.getSelection()?.addRange(range);
}

describe('smart compose ghost helpers', () => {
	afterEach(() => document.body.replaceChildren());

	it('reads the paragraph before the caret only when nothing follows it', () => {
		const root = document.createElement('div');
		root.innerHTML = '<div>Hello there</div><div>Let me know</div><div>-- <br>Me</div>';
		document.body.append(root);
		const line = root.children[1]!.firstChild!;
		placeCaret(line, 11);
		expect(caretText(root)?.before).toBe('Let me know');
		placeCaret(line, 3);
		expect(caretText(root)).toBeNull();
	});

	it('accepts a long, mostly sideways swipe to the right', () => {
		expect(isAcceptSwipe(60, 10)).toBe(true);
		expect(isAcceptSwipe(60, 40)).toBe(false);
		expect(isAcceptSwipe(-60, 0)).toBe(false);
		expect(isAcceptSwipe(20, 0)).toBe(false);
	});

	it('turns the body into the user’s own lines, without quoted mail', () => {
		const html =
			'<div>See you there.</div><div>Bring snacks<br>please</div><blockquote>Old mail</blockquote>';
		expect(ownBodyText(html).trim().split('\n')).toEqual([
			'See you there.',
			'Bring snacks',
			'please'
		]);
	});
});
