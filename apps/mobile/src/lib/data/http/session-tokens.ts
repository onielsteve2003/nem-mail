import {
	AccountSchema,
	AppError,
	IsoDateTimeSchema,
	type Account,
	type SessionResponse,
	type User
} from '@nem/shared';

/** localStorage key for every account signed in on this device. */
export const SESSIONS_KEY = 'nem-mail:sessions';

/** Small slice of Storage, so tests can pass a fake. */
export type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface StoredSession {
	account: Account;
	token: string;
	expiresAt: string;
}

interface Saved {
	activeId: string | null;
	sessions: StoredSession[];
}

const EMPTY: Saved = { activeId: null, sessions: [] };

/**
 * The bearer tokens of every account signed in on this device (FR-1.3). Each account keeps its
 * own server session, so switching accounts is local and signing one out leaves the others signed
 * in. Saved to localStorage: cookies are not an option because Capacitor runs cross-origin
 * (ADR-7). Expired sessions are dropped when read.
 */
export class SessionTokens {
	readonly #storage: TokenStorage | undefined;
	readonly #now: () => number;
	#saved: Saved;

	constructor(storage: TokenStorage | undefined, now: () => number = Date.now) {
		this.#storage = storage;
		this.#now = now;
		this.#saved = this.#load();
	}

	/** The token for `Authorization: Bearer`, or null when nobody is signed in. */
	get token(): string | null {
		return this.#active()?.token ?? null;
	}

	get activeId(): string | null {
		return this.#active()?.account.id ?? null;
	}

	/** Signed-in accounts in the order they were added, for the account switcher. */
	accounts(): Account[] {
		return this.#saved.sessions.map((s) => s.account);
	}

	/**
	 * Stores a sign-in or sign-up and makes that account active. Signing in again to an account
	 * already on the device replaces its token and keeps its place in the list.
	 */
	add(response: SessionResponse): Account {
		const { token, expiresAt, user } = response;
		const existing = this.#find(user.id);
		const account: Account = {
			...pickAccount(user),
			signedInAt: existing?.account.signedInAt ?? new Date(this.#now()).toISOString()
		};
		const session = { account, token, expiresAt };
		const sessions = existing
			? this.#saved.sessions.map((s) => (s.account.id === user.id ? session : s))
			: [...this.#saved.sessions, session];
		this.#save({ activeId: user.id, sessions });
		return account;
	}

	/** @throws AppError NOT_FOUND unless the account is signed in on this device. */
	switchTo(userId: string): Account {
		const session = this.#find(userId);
		if (!session) throw new AppError('NOT_FOUND', 'That account is not signed in');
		this.#save({ ...this.#saved, activeId: userId });
		return session.account;
	}

	/**
	 * Forgets an account's token: after sign-out, or when the server answers 401 for it. The first
	 * remaining account becomes active. Returns the new active id, or null when none are left.
	 */
	remove(userId: string): string | null {
		const sessions = this.#saved.sessions.filter((s) => s.account.id !== userId);
		const activeId =
			this.#saved.activeId === userId ? (sessions[0]?.account.id ?? null) : this.#saved.activeId;
		this.#save({ activeId, sessions });
		return activeId;
	}

	/** Refreshes the stored name and avatar after `GET /me`, so the switcher stays current. */
	updateUser(user: User): void {
		const session = this.#find(user.id);
		if (!session) return;
		const account = { ...pickAccount(user), signedInAt: session.account.signedInAt };
		this.#save({
			...this.#saved,
			sessions: this.#saved.sessions.map((s) => (s.account.id === user.id ? { ...s, account } : s))
		});
	}

	#active(): StoredSession | undefined {
		const { activeId } = this.#saved;
		return activeId ? this.#find(activeId) : undefined;
	}

	#find(userId: string): StoredSession | undefined {
		return this.#saved.sessions.find((s) => s.account.id === userId);
	}

	/** Unreadable, blocked or tampered storage counts as signed out. */
	#load(): Saved {
		let raw: string | null | undefined;
		try {
			raw = this.#storage?.getItem(SESSIONS_KEY);
		} catch {
			return EMPTY;
		}
		if (!raw) return EMPTY;
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return EMPTY;
		}
		if (!isRecord(parsed) || !Array.isArray(parsed.sessions)) return EMPTY;
		const now = this.#now();
		const sessions = parsed.sessions
			.filter(isStoredSession)
			.filter((s) => Date.parse(s.expiresAt) > now);
		const activeId = sessions.some((s) => s.account.id === parsed.activeId)
			? (parsed.activeId as string)
			: (sessions[0]?.account.id ?? null);
		return { activeId, sessions };
	}

	#save(saved: Saved): void {
		this.#saved = saved;
		try {
			if (saved.sessions.length) this.#storage?.setItem(SESSIONS_KEY, JSON.stringify(saved));
			else this.#storage?.removeItem(SESSIONS_KEY);
		} catch {
			// Private mode or quota: the accounts stay signed in until the app closes.
		}
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** Drops entries a different app version or a hand edit left in an unexpected shape. */
function isStoredSession(value: unknown): value is StoredSession {
	return (
		isRecord(value) &&
		typeof value.token === 'string' &&
		value.token.length > 0 &&
		IsoDateTimeSchema.safeParse(value.expiresAt).success &&
		AccountSchema.safeParse(value.account).success
	);
}

function pickAccount({ id, email, name, avatarSeed }: User): Omit<Account, 'signedInAt'> {
	return { id, email, name, avatarSeed };
}
