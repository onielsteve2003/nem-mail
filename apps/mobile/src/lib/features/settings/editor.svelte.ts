import { DEFAULT_SETTINGS, type Settings } from '@nem/shared';
import type { SettingsRepository } from '#lib/data/repositories.js';
import { toastStore } from '#lib/stores/toast.svelte.js';
import { errorMessage } from '#lib/utils/errors.js';

const SAVE_FAILED = 'Could not save settings.';

/**
 * One settings screen's working copy: loads the saved settings, applies a change on
 * screen at once, then saves it. A failed save rolls back and shows a toast.
 */
export class SettingsEditor {
	settings = $state<Settings>(structuredClone(DEFAULT_SETTINGS));

	readonly #repo: SettingsRepository;
	/** Runs after a change is applied and again after a rollback, e.g. to repaint the theme. */
	readonly #onapply: (settings: Settings) => void;

	constructor(repo: SettingsRepository, onapply: (settings: Settings) => void = () => {}) {
		this.#repo = repo;
		this.#onapply = onapply;
	}

	/** Defaults stay on screen when loading fails; the first change saves them. */
	async load(override: Partial<Settings> = {}): Promise<void> {
		try {
			this.settings = { ...(await this.#repo.get()), ...override };
		} catch {
			this.settings = { ...this.settings, ...override };
		}
	}

	async update(patch: Partial<Settings>): Promise<void> {
		const before = this.settings;
		this.settings = { ...before, ...patch };
		this.#onapply(this.settings);
		try {
			this.settings = await this.#repo.save($state.snapshot(this.settings));
		} catch (error) {
			this.settings = before;
			this.#onapply(before);
			toastStore.show({ message: errorMessage(error, SAVE_FAILED), tone: 'error' });
		}
	}
}
