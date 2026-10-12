import { MAX_ATTACHMENT_BYTES, type Attachment } from '@nem/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	checkFile,
	mockProgress,
	mockUploadMs,
	pendingAttachment,
	readyAttachment,
	uploaded,
	uploadWithProgress
} from './attachments.js';

const ATT: Attachment = { id: 'att-1', filename: 'a.pdf', mime: 'application/pdf', size: 10 };
const file = (size: number, name = 'a.pdf') =>
	new File([new Uint8Array(size)], name, { type: 'application/pdf' });

describe('compose attachments', () => {
	afterEach(() => vi.useRealTimers());

	it('accepts files up to 10 MB and names the size of bigger ones', () => {
		expect(checkFile({ size: MAX_ATTACHMENT_BYTES })).toBeNull();
		expect(checkFile({ size: MAX_ATTACHMENT_BYTES + 1 })).toBe('Over 10 MB (10 MB)');
		expect(checkFile({ size: 12 * 1024 * 1024 })).toBe('Over 10 MB (12 MB)');
		expect(pendingAttachment(file(5), 'k').status).toBe('uploading');
		const tooBig = pendingAttachment(
			{ name: 'big.zip', type: '', size: 11 * 1024 * 1024 } as File,
			'k'
		);
		expect(tooBig).toMatchObject({ status: 'error', mime: 'application/octet-stream' });
	});

	it('eases progress up, holds at 95% and takes longer for bigger files', () => {
		expect(mockProgress(0, 1000)).toBe(0);
		expect(mockProgress(200, 1000)).toBeGreaterThan(0.5);
		expect(mockProgress(60_000, 1000)).toBe(0.95);
		expect(mockUploadMs(10_000_000)).toBeGreaterThan(mockUploadMs(1000));
	});

	it('reports progress and finishes at 100% once the upload answers', async () => {
		vi.useFakeTimers();
		const onprogress = vi.fn();
		const done = uploadWithProgress(file(1000), () => Promise.resolve(ATT), onprogress);
		await vi.advanceTimersByTimeAsync(mockUploadMs(1000));
		await expect(done).resolves.toEqual(ATT);
		expect(onprogress.mock.calls.length).toBeGreaterThan(2);
		expect(onprogress).toHaveBeenLastCalledWith(1);
	});

	it('rejects with the upload error and stops ticking', async () => {
		vi.useFakeTimers();
		const onprogress = vi.fn();
		const done = uploadWithProgress(file(1), () => Promise.reject(new Error('boom')), onprogress);
		await expect(done).rejects.toThrow('boom');
		const calls = onprogress.mock.calls.length;
		await vi.advanceTimersByTimeAsync(1000);
		expect(onprogress.mock.calls.length).toBe(calls);
	});

	it('lists only uploaded attachments', () => {
		expect(uploaded([readyAttachment(ATT), pendingAttachment(file(1), 'k')])).toEqual([ATT]);
	});
});
