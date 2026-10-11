import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from '@nem/shared';
import type { SettingsRepository } from '../repositories.js';
import { validate, type MockContext } from './context.js';
import { stripOwner } from './db.js';

export class MockSettingsRepository implements SettingsRepository {
	readonly #ctx: MockContext;

	constructor(ctx: MockContext) {
		this.#ctx = ctx;
	}

	/** Saved settings with any newer fields filled from defaults. */
	get(): Promise<Settings> {
		return this.#ctx.authed(async (db, userId) => {
			const saved = await db.get('settings', userId);
			return saved ? SettingsSchema.parse(stripOwner(saved)) : structuredClone(DEFAULT_SETTINGS);
		});
	}

	/** @throws AppError VALIDATION_FAILED for an invalid value. */
	save(settings: Settings): Promise<Settings> {
		return this.#ctx.authed(async (db, userId) => {
			const valid = validate(SettingsSchema, settings);
			await db.put('settings', { ...valid, ownerId: userId });
			return valid;
		});
	}
}
