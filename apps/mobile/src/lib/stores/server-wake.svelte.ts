/** `waking` once the server is clearly asleep; `slow` once the offline demo is worth offering. */
export type WakeStatus = 'checking' | 'waking' | 'slow' | 'awake';

export interface ServerWakeOptions {
	/** A ping slower than this means a cold start. */
	wakingAfterMs?: number;
	slowAfterMs?: number;
}

/** Cold-start state for the splash: the free API host sleeps when idle (PRD §11). */
export class ServerWake {
	status = $state<WakeStatus>('checking');
	readonly #wakingAfterMs: number;
	readonly #slowAfterMs: number;

	constructor({ wakingAfterMs = 1500, slowAfterMs = 20_000 }: ServerWakeOptions = {}) {
		this.#wakingAfterMs = wakingAfterMs;
		this.#slowAfterMs = slowAfterMs;
	}

	/** Runs `wake`, moving through the states while it takes long. */
	async run(wake: () => Promise<void>): Promise<void> {
		this.status = 'checking';
		const waking = setTimeout(() => (this.status = 'waking'), this.#wakingAfterMs);
		const slow = setTimeout(() => (this.status = 'slow'), this.#slowAfterMs);
		try {
			await wake();
			this.status = 'awake';
		} finally {
			clearTimeout(waking);
			clearTimeout(slow);
		}
	}
}
