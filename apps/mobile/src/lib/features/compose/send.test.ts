import { AppError, type Draft } from '@nem/shared';
import { describe, expect, it, vi } from 'vitest';
import type { DraftRepository } from '#lib/data/repositories.js';
import { ToastStore } from '#lib/stores/toast.svelte.js';
import type { ComposeAttachment } from './attachments.js';
import { parseRecipient } from './recipients.js';
import { SEND_COPY, sendDraft, sendProblem } from './send.js';

const r = (raw: string) => parseRecipient(raw)!;
const DRAFT = { id: 'draft-1', threadId: null } as Draft;
const RESPONSE = { messageId: 'm1', threadId: 't1', sendAt: '2026-10-12T10:00:05.000Z' };

function setup(drafts: Partial<DraftRepository>) {
	const toasts = new ToastStore();
	const deps = {
		drafts: { save: vi.fn().mockResolvedValue(DRAFT), ...drafts } as DraftRepository,
		toasts,
		onsent: vi.fn(),
		onundo: vi.fn()
	};
	return { deps, toasts };
}

describe('sendProblem', () => {
	const none = { to: [], cc: [], bcc: [] };
	const file = (status: ComposeAttachment['status']) => ({ status }) as ComposeAttachment;

	it('needs a valid recipient and finished attachments', () => {
		expect(sendProblem(none, [])).toBe(SEND_COPY.noRecipients);
		expect(sendProblem({ ...none, bcc: [r('nope')] }, [])).toBe(SEND_COPY.invalid('nope'));
		const ok = { ...none, cc: [r('ada@example.com')] };
		expect(sendProblem(ok, [file('uploading')])).toBe(SEND_COPY.uploading);
		expect(sendProblem(ok, [file('error')])).toBe(SEND_COPY.failedFiles);
		expect(sendProblem(ok, [file('ready')])).toBeNull();
	});
});

describe('sendDraft', () => {
	it('shows Sending…, then Sent with Undo that brings the draft back', async () => {
		let resolve!: (value: typeof RESPONSE) => void;
		const send = vi.fn(() => new Promise<typeof RESPONSE>((res) => (resolve = res)));
		const restored = { ...DRAFT, id: 'draft-2' };
		const { deps, toasts } = setup({ send, cancelSend: vi.fn().mockResolvedValue(restored) });
		const done = sendDraft(DRAFT, deps);
		expect(toasts.current?.message).toBe(SEND_COPY.sending);
		resolve(RESPONSE);
		await expect(done).resolves.toBe(true);
		expect(deps.onsent).toHaveBeenCalledWith(RESPONSE);
		expect(toasts.current).toMatchObject({ message: SEND_COPY.sent, action: { label: 'Undo' } });
		toasts.runAction(toasts.current!.id);
		await vi.waitFor(() => expect(deps.onundo).toHaveBeenCalledWith(restored));
		expect(deps.drafts.cancelSend).toHaveBeenCalledWith('m1');
		expect(toasts.current?.message).toBe(SEND_COPY.cancelled);
	});

	it('says it is too late when the message already went out', async () => {
		const { deps, toasts } = setup({
			send: vi.fn().mockResolvedValue(RESPONSE),
			cancelSend: vi.fn().mockRejectedValue(new AppError('CONFLICT', 'Already sent'))
		});
		await sendDraft(DRAFT, deps);
		toasts.runAction(toasts.current!.id);
		await vi.waitFor(() => expect(toasts.current?.message).toBe(SEND_COPY.tooLate));
		expect(deps.onundo).not.toHaveBeenCalled();
	});

	it('saves the draft on failure and retries when the error allows it', async () => {
		const send = vi
			.fn()
			.mockRejectedValueOnce(new AppError('NETWORK', 'offline'))
			.mockResolvedValue(RESPONSE);
		const { deps, toasts } = setup({ send });
		await expect(sendDraft(DRAFT, deps)).resolves.toBe(false);
		expect(deps.drafts.save).toHaveBeenCalledWith(DRAFT);
		expect(toasts.current).toMatchObject({
			message: SEND_COPY.savedToDrafts,
			tone: 'error',
			action: { label: 'Retry' }
		});
		toasts.runAction(toasts.current!.id);
		await vi.waitFor(() => expect(deps.onsent).toHaveBeenCalled());
	});

	it('offers no Retry for errors that would fail again', async () => {
		const { deps, toasts } = setup({
			send: vi.fn().mockRejectedValue(new AppError('VALIDATION_FAILED', 'bad'))
		});
		await sendDraft(DRAFT, deps);
		expect(toasts.current?.action).toBeUndefined();
	});
});
