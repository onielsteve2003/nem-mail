import { describe, expect, it } from 'vitest';
import { dismiss, dismissedKey, loadDismissed } from './dismissed';

function fakeStorage(): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('dismissed nudges', () => {
	it('saves per account and survives bad or blocked storage', () => {
		const storage = fakeStorage();
		const list = dismiss(storage, 'u1', [], 'followup:m1');
		expect(loadDismissed(storage, 'u1')).toEqual(['followup:m1']);
		expect(loadDismissed(storage, 'u2')).toEqual([]);
		expect(dismiss(storage, 'u1', list, 'followup:m1')).toEqual(['followup:m1']);
		storage.data.set(dismissedKey('u1'), '{not json');
		expect(loadDismissed(storage, 'u1')).toEqual([]);
		const blocked = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		expect(loadDismissed(blocked, 'u1')).toEqual([]);
		expect(dismiss(blocked, 'u1', [], 'x')).toEqual(['x']);
	});
});
