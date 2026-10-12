import { DEFAULT_SETTINGS, type AIFeature, type Settings } from '@nem/shared';
import { createContext } from 'svelte';
import type { SettingsRepository } from '#lib/data/repositories.js';
import type { AIBackend } from './backend.js';
import { MODELS } from './registry.js';
import type { AIWorkerConnection } from './worker/connect.js';

export type AIToggles = Settings['ai'];

const DOWNLOAD_FAILED = 'Download failed. Check your connection and try again.';

/** Where one optional model stands on this device. */
export interface ModelState {
	status: 'unknown' | 'absent' | 'downloading' | 'ready' | 'error';
	/** 0 to 1 while downloading. */
	progress: number;
	error: string | null;
}

/** Starts the worker on first use; tests pass an in-thread one. */
export type ConnectWorker = () => Promise<AIWorkerConnection>;

const connectDefault: ConnectWorker = async () =>
	(await import('./worker/connect.js')).connectWorker();

/**
 * The facade every AI feature goes through (architecture §3). It owns the worker,
 * which starts only when something first needs it, the feature flags from Settings,
 * and the download state of the optional models for the model manager.
 */
export class AIService {
	backend = $state<AIBackend | 'unknown'>('unknown');
	toggles = $state<AIToggles>({ ...DEFAULT_SETTINGS.ai });
	models = $state<Record<string, ModelState>>(
		Object.fromEntries(
			MODELS.map((model) => [model.id, { status: 'unknown', progress: 0, error: null }])
		)
	);

	#connection: Promise<AIWorkerConnection> | undefined;

	constructor(
		private readonly settings: SettingsRepository | null = null,
		private readonly connect: ConnectWorker = connectDefault
	) {}

	/** True when the user has the feature on in Settings (all are on by default). */
	isEnabled(feature: AIFeature): boolean {
		return this.toggles[feature];
	}

	/** Reads the feature flags from saved settings; keeps the defaults when that fails. */
	async loadToggles(): Promise<void> {
		if (!this.settings) return;
		try {
			this.toggles = { ...(await this.settings.get()).ai };
		} catch {
			// Settings are unavailable (signed out, storage blocked): every feature stays on.
		}
	}

	/** Detects the backend and which models are downloaded, for the model manager. */
	async refresh(): Promise<void> {
		const { api } = await this.#worker();
		const [backend, cached] = await Promise.all([api.backend(), api.cachedModels()]);
		this.backend = backend;
		for (const [id, state] of Object.entries(this.models)) {
			if (state.status === 'downloading') continue;
			this.models[id] = {
				status: cached.includes(id) ? 'ready' : 'absent',
				progress: cached.includes(id) ? 1 : 0,
				error: null
			};
		}
	}

	/** Downloads a model with live progress. Failures land in its state, not as a throw. */
	async download(id: string): Promise<void> {
		if (this.models[id]?.status === 'downloading') return;
		this.models[id] = { status: 'downloading', progress: 0, error: null };
		try {
			const { api } = await this.#worker();
			await api.download(id, ({ loaded, total }) => {
				const state = this.models[id];
				if (state && total > 0) state.progress = Math.min(loaded / total, 1);
			});
			this.models[id] = { status: 'ready', progress: 1, error: null };
		} catch {
			this.models[id] = { status: 'error', progress: 0, error: DOWNLOAD_FAILED };
		}
	}

	/** Deletes a downloaded model to free space. */
	async remove(id: string): Promise<void> {
		const { api } = await this.#worker();
		await api.remove(id);
		this.models[id] = { status: 'absent', progress: 0, error: null };
	}

	/** Stops the worker; the next call starts a fresh one. */
	dispose(): void {
		void this.#connection?.then((connection) => connection.terminate());
		this.#connection = undefined;
	}

	#worker(): Promise<AIWorkerConnection> {
		this.#connection ??= this.connect().catch((error: unknown) => {
			this.#connection = undefined;
			throw error;
		});
		return this.#connection;
	}
}

export const [getAIService, setAIService] = createContext<AIService>();
