import {
	AppError,
	CreateLabelRequestSchema,
	UpdateLabelRequestSchema,
	type CreateLabelRequest,
	type Label,
	type UpdateLabelRequest
} from '@nem/shared';
import type { LabelRepository } from '../repositories.js';
import { newId, validate, type MockContext } from './context.js';
import { stripOwner, type MockDb, type Owned } from './db.js';

export class MockLabelRepository implements LabelRepository {
	readonly #ctx: MockContext;

	constructor(ctx: MockContext) {
		this.#ctx = ctx;
	}

	/** Labels in name order. */
	list(): Promise<Label[]> {
		return this.#ctx.authed(async (db, userId) =>
			(await ownLabels(db, userId)).map((l) => stripOwner(l)).sort(byName)
		);
	}

	create(request: CreateLabelRequest): Promise<Label> {
		return this.#ctx.authed(async (db, userId) => {
			const input = validate(CreateLabelRequestSchema, request);
			const label: Owned<Label> = { ...input, id: newId(`${userId}-l`), ownerId: userId };
			checkLabel(label, await ownLabels(db, userId));
			await db.put('labels', label);
			return stripOwner(label);
		});
	}

	update(labelId: string, request: UpdateLabelRequest): Promise<Label> {
		return this.#ctx.authed(async (db, userId) => {
			const changes = validate(UpdateLabelRequestSchema, request);
			const labels = await ownLabels(db, userId);
			const current = labels.find((l) => l.id === labelId);
			if (!current) throw new AppError('NOT_FOUND', 'Label not found');
			const label = { ...current, ...changes };
			checkLabel(label, labels);
			await db.put('labels', label);
			return stripOwner(label);
		});
	}

	remove(labelId: string): Promise<void> {
		return this.#ctx.authed(async (db, userId) => {
			const tx = db.transaction(['labels', 'threads'], 'readwrite');
			const labels = tx.objectStore('labels');
			const label = await labels.get(labelId);
			if (!label || label.ownerId !== userId) throw new AppError('NOT_FOUND', 'Label not found');
			await labels.delete(labelId);
			for (const child of await labels.index('byOwner').getAll(userId)) {
				if (child.parentId === labelId) await labels.put({ ...child, parentId: null });
			}
			const threads = tx.objectStore('threads');
			for (const thread of await threads.index('byOwner').getAll(userId)) {
				if (thread.labelIds.includes(labelId)) {
					await threads.put({
						...thread,
						labelIds: thread.labelIds.filter((id) => id !== labelId)
					});
				}
			}
			await tx.done;
		});
	}
}

function ownLabels(db: MockDb, userId: string): Promise<Owned<Label>[]> {
	return db.getAllFromIndex('labels', 'byOwner', userId);
}

function byName(a: Label, b: Label): number {
	return a.name.localeCompare(b.name);
}

/**
 * Names are unique among siblings (ignoring case) and labels nest one level (FR-2.4).
 * @throws AppError CONFLICT or VALIDATION_FAILED.
 */
function checkLabel(label: Label, existing: Label[]): void {
	const name = label.name.toLowerCase();
	const others = existing.filter((l) => l.id !== label.id);
	if (others.some((l) => l.parentId === label.parentId && l.name.toLowerCase() === name)) {
		throw new AppError('CONFLICT', 'A label with that name already exists');
	}
	if (label.parentId === null) return;
	const parent = others.find((l) => l.id === label.parentId);
	if (!parent || parent.parentId !== null || others.some((l) => l.parentId === label.id)) {
		throw new AppError('VALIDATION_FAILED', 'Labels nest one level deep');
	}
}
