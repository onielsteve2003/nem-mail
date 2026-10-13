import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { checkTone } from '#lib/ai/models/tone.js';
import { toneBeforeSend } from './tone.js';
import ToneSheet from './ToneSheet.svelte';

const harsh = checkTone('This is ridiculous and useless.')!;

describe('tone before send', () => {
	it('stops only for a harsh verdict, and never blocks on a slow or failed check', async () => {
		expect(await toneBeforeSend(async () => harsh)).toBe(harsh);
		expect(await toneBeforeSend(async () => checkTone('Thanks!'))).toBeNull();
		expect(await toneBeforeSend(() => Promise.reject(new Error('worker')))).toBeNull();
		expect(await toneBeforeSend(() => new Promise(() => {}), 10)).toBeNull();
	});

	it('shows what stood out and lets the user edit or send anyway', async () => {
		const onedit = vi.fn();
		const onsend = vi.fn();
		render(ToneSheet, { open: true, verdict: harsh, onedit, onsend });
		expect(screen.getByText('ridiculous')).toBeTruthy();
		expect(screen.getByText('useless')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Send anyway' }));
		expect(onsend).toHaveBeenCalledOnce();
		expect(onedit).not.toHaveBeenCalled();
	});
});
