import type {
	Account,
	AppError,
	SessionResponse,
	SignInRequest,
	SignUpRequest,
	User
} from '@nem/shared';
import { createContext } from 'svelte';
import type { AuthRepository } from '#lib/data/repositories.js';
import { toAppError } from '#lib/utils/errors.js';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Who is signed in, plus the other accounts on this device (FR-1). Sign-in
 * errors are thrown to the form that called; only `restore` keeps its error.
 */
export class SessionStore {
	user = $state<User | null>(null);
	accounts = $state<Account[]>([]);
	status = $state<LoadStatus>('idle');
	error = $state<AppError | null>(null);
	readonly isSignedIn = $derived(this.user !== null);

	readonly #auth: AuthRepository;

	constructor(auth: AuthRepository) {
		this.#auth = auth;
	}

	/** Restores the saved session on app start. */
	async restore(): Promise<void> {
		this.status = 'loading';
		this.error = null;
		try {
			await this.#refresh(await this.#auth.me());
			this.status = 'ready';
		} catch (error) {
			this.error = toAppError(error);
			this.status = 'error';
		}
	}

	signIn(request: SignInRequest): Promise<User> {
		return this.#enter(this.#auth.signIn(request));
	}

	signUp(request: SignUpRequest): Promise<User> {
		return this.#enter(this.#auth.signUp(request));
	}

	/** Signs out the current account; the next signed-in account, if any, takes over. */
	async signOut(): Promise<void> {
		await this.#auth.signOut();
		await this.#refresh(await this.#auth.me());
	}

	async switchAccount(accountId: string): Promise<void> {
		await this.#refresh(await this.#auth.switchAccount(accountId));
	}

	async #enter(session: Promise<SessionResponse>): Promise<User> {
		const { user } = await session;
		await this.#refresh(user);
		this.status = 'ready';
		return user;
	}

	async #refresh(user: User | null): Promise<void> {
		this.accounts = user ? await this.#auth.listAccounts() : [];
		this.user = user;
	}
}

export const [getSessionStore, setSessionStore] = createContext<SessionStore>();
