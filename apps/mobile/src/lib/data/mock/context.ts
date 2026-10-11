import { AppError, type ServerEvent } from '@nem/shared';
import { getMockDb, type MockDb } from './db.js';

/** Simulated network: every call waits 150–600 ms (architecture §3). */
export const LATENCY_MIN_MS = 150;
export const LATENCY_MAX_MS = 600;

export interface MockContextOptions {
	db?: () => Promise<MockDb>;
	/** Share of calls that fail with a NETWORK error, 0–1 (`?fail=0.1`). */
	failRate?: number;
	latency?: { min: number; max: number };
	random?: () => number;
	now?: () => number;
	userId?: string | null;
}

/**
 * State every mock repository shares: the database, the signed-in user,
 * the simulated network and the event hub behind `subscribe`.
 */
export class MockContext {
	readonly db: () => Promise<MockDb>;
	readonly now: () => number;
	/** The signed-in account; demo auth sets it. */
	userId: string | null;
	failRate: number;
	#latency: { min: number; max: number };
	#random: () => number;
	#listeners = new Set<(event: ServerEvent) => void>();

	constructor(options: MockContextOptions = {}) {
		this.db = options.db ?? getMockDb;
		this.now = options.now ?? Date.now;
		this.userId = options.userId ?? null;
		this.failRate = options.failRate ?? 0;
		this.#latency = options.latency ?? { min: LATENCY_MIN_MS, max: LATENCY_MAX_MS };
		this.#random = options.random ?? Math.random;
	}

	/**
	 * Runs one simulated request: waits, maybe fails (before any write, so a
	 * failed call changes nothing), then does the work.
	 */
	async request<T>(work: (db: MockDb) => Promise<T>): Promise<T> {
		const { min, max } = this.#latency;
		if (max > 0) await delay(min + this.#random() * (max - min));
		if (this.#random() < this.failRate) {
			throw new AppError('NETWORK', 'Simulated network failure');
		}
		return work(await this.db());
	}

	/** Like `request`, for calls that need a signed-in user. */
	authed<T>(work: (db: MockDb, userId: string) => Promise<T>): Promise<T> {
		return this.request((db) => {
			const userId = this.userId;
			if (!userId) throw new AppError('UNAUTHORIZED', 'Sign in first');
			return work(db, userId);
		});
	}

	subscribe(listener: (event: ServerEvent) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	emit(event: ServerEvent): void {
		for (const listener of this.#listeners) listener(event);
	}
}

/** Reads `?fail=0.1` from a query string; anything invalid means no injected failures. */
export function readFailRate(search: string): number {
	const value = Number(new URLSearchParams(search).get('fail'));
	return Number.isFinite(value) && value > 0 ? Math.min(value, 1) : 0;
}

/** A fresh id for records the mock creates, e.g. `u1-x3f9c2a1b`. */
export function newId(prefix: string): string {
	return `${prefix}${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

/** The slice of a Zod schema `validate` needs (mobile does not depend on zod directly). */
interface Parseable<T> {
	safeParse(
		value: unknown
	): { success: true; data: T } | { success: false; error: { issues: unknown } };
}

/** Parses like the API would. @throws AppError VALIDATION_FAILED with the Zod issues. */
export function validate<T>(schema: Parseable<T>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success) {
		throw new AppError('VALIDATION_FAILED', 'Invalid request', result.error.issues);
	}
	return result.data;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
