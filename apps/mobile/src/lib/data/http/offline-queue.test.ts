import { AppError } from '@nem/shared';
import { describe, expect, it, vi } from 'vitest';
import { OfflineQueue } from './offline-queue.js';

function memoryStorage() {
	const items = new Map<string, string>();
	return {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value),
		removeItem: (key: string) => void items.delete(key)
	};
}

function setup() {
	const state = { userId: 'u1' as string | null, isOnline: true };
	const storage = memoryStorage();
	const call = vi.fn<(name: string, options: object) => Promise<unknown>>(async () => ({
		updatedIds: ['t1']
	}));
	const make = () =>
		new OfflineQueue({
			http: { call } as never,
			storage,
			userId: () => state.userId,
			isOnline: () => state.isOnline
		});
	return { state, storage, call, queue: make(), make };
}

const offline = () => ({ updatedIds: ['offline'] });
const archive = { body: { ids: ['t1'], op: { op: 'archive' as const } } };

describe('OfflineQueue', () => {
	it('sends straight away when online', async () => {
		const { queue, call } = setup();
		await expect(queue.call('bulkThreads', archive, offline)).resolves.toEqual({
			updatedIds: ['t1']
		});
		expect(call).toHaveBeenCalledWith('bulkThreads', { params: undefined, body: archive.body });
		expect(queue.pending).toBe(0);
	});

	it('queues on a network error, keeps it across reloads, and replays it in order', async () => {
		const { queue, call, make } = setup();
		call.mockRejectedValueOnce(new AppError('NETWORK', 'down'));
		await expect(queue.call('bulkThreads', archive, offline)).resolves.toEqual({
			updatedIds: ['offline']
		});
		// A later change waits behind the queued one, so the server sees them in order.
		call.mockRejectedValueOnce(new AppError('NETWORK', 'still down'));
		await queue.call('deleteDraft', { params: { id: 'd1' } }, () => ({ ok: true }));
		await vi.waitFor(() => expect(queue.pending).toBe(2));

		const reloaded = make();
		expect(reloaded.pending).toBe(2);
		await expect(reloaded.flush()).resolves.toBe(2);
		expect(call.mock.calls.slice(-2).map(([name]) => name)).toEqual(['bulkThreads', 'deleteDraft']);
		expect(reloaded.pending).toBe(0);
	});

	it('queues without trying while the device is offline', async () => {
		const { queue, call, state } = setup();
		state.isOnline = false;
		await queue.call('putSettings', { body: {} as never }, () => ({}) as never);
		expect(call).not.toHaveBeenCalled();
		expect(queue.pending).toBe(1);
		state.isOnline = true;
		await queue.flush();
		expect(call).toHaveBeenCalledOnce();
	});

	it('throws server refusals instead of queueing, and drops them on replay', async () => {
		const { queue, call, state } = setup();
		call.mockRejectedValueOnce(new AppError('VALIDATION_FAILED', 'bad'));
		await expect(queue.call('bulkThreads', archive, offline)).rejects.toThrow('bad');
		expect(queue.pending).toBe(0);

		state.isOnline = false;
		await queue.call('bulkThreads', archive, offline);
		state.isOnline = true;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		call.mockRejectedValueOnce(new AppError('NOT_FOUND', 'gone'));
		await expect(queue.flush()).resolves.toBe(0);
		expect(queue.pending).toBe(0);
		expect(warn).toHaveBeenCalledOnce();
	});

	it("replays only the active account's changes", async () => {
		const { queue, call, state } = setup();
		state.isOnline = false;
		await queue.call('bulkThreads', archive, offline);
		state.userId = 'u2';
		state.isOnline = true;
		await expect(queue.flush()).resolves.toBe(0);
		expect(call).not.toHaveBeenCalled();
		state.userId = 'u1';
		await expect(queue.flush()).resolves.toBe(1);
	});
});
