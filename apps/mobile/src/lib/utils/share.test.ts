import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareContent } from './share.js';

const content = { title: 'Quarterly plan', text: 'Grace:\nSee you Monday.' };

afterEach(() => vi.unstubAllGlobals());

function stubNavigator(value: Partial<Navigator>): void {
	vi.stubGlobal('navigator', { share: undefined, clipboard: undefined, ...value });
}

describe('shareContent (web)', () => {
	it('uses the Web Share API when the browser has it', async () => {
		const share = vi.fn(async () => {});
		stubNavigator({ share });
		expect(await shareContent(content)).toBe('shared');
		expect(share).toHaveBeenCalledWith(content);
	});

	it('treats a dismissed share sheet as cancelled, not an error', async () => {
		stubNavigator({ share: vi.fn(async () => Promise.reject(new DOMException('', 'AbortError'))) });
		expect(await shareContent(content)).toBe('cancelled');
	});

	it('copies to the clipboard without Web Share', async () => {
		const writeText = vi.fn(async () => {});
		stubNavigator({ clipboard: { writeText } as unknown as Clipboard });
		expect(await shareContent(content)).toBe('copied');
		expect(writeText).toHaveBeenCalledWith('Quarterly plan\n\nGrace:\nSee you Monday.');
	});

	it('reports unsupported when neither exists', async () => {
		stubNavigator({});
		expect(await shareContent(content)).toBe('unsupported');
	});
});
