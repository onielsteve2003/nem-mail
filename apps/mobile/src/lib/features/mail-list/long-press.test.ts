import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS, longPress } from './long-press.js';

function pointer(type: string, x = 0, y = 0): Event {
	const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
	return Object.assign(event, { isPrimary: true });
}

describe('longPress', () => {
	let node: HTMLElement;
	let onlongpress: ReturnType<typeof vi.fn<() => void>>;
	let action: ReturnType<typeof longPress>;

	beforeEach(() => {
		vi.useFakeTimers();
		node = document.createElement('div');
		onlongpress = vi.fn<() => void>();
		action = longPress(node, onlongpress);
	});
	afterEach(() => {
		action.destroy();
		vi.useRealTimers();
	});

	it('fires after a still press and swallows the click that ends it', () => {
		node.dispatchEvent(pointer('pointerdown'));
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(onlongpress).toHaveBeenCalledOnce();
		const click = pointer('click');
		node.dispatchEvent(click);
		expect(click.defaultPrevented).toBe(true);
	});

	it('does not fire for a tap, a scroll or a swipe', () => {
		node.dispatchEvent(pointer('pointerdown'));
		node.dispatchEvent(pointer('pointerup'));
		node.dispatchEvent(pointer('pointerdown'));
		node.dispatchEvent(pointer('pointermove', 0, 30));
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(onlongpress).not.toHaveBeenCalled();
		const click = pointer('click');
		node.dispatchEvent(click);
		expect(click.defaultPrevented).toBe(false);
	});

	it('treats the browser long-press menu as the press, once', () => {
		node.dispatchEvent(pointer('pointerdown'));
		const menu = pointer('contextmenu');
		node.dispatchEvent(menu);
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(menu.defaultPrevented).toBe(true);
		expect(onlongpress).toHaveBeenCalledOnce();
	});
});
