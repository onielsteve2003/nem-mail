import {
	AppError,
	DEFAULT_SETTINGS,
	SignInRequestSchema,
	SignUpRequestSchema,
	type Account,
	type SessionResponse,
	type SignInRequest,
	type SignUpRequest,
	type User
} from '@nem/shared';
import type { AuthRepository } from '../repositories.js';
import { newId, validate, type MockContext } from './context.js';
import { getMeta, setMeta, type MockDb, type SessionMeta } from './db.js';

// The seeded demo accounts live in @nem/shared so the onboarding screen can name them.
export { DEMO_EMAIL, DEMO_WORK_EMAIL } from '@nem/shared';

const SESSION_DAYS = 30;
const EMPTY_SESSION: SessionMeta = { userId: null, accounts: [] };

/** Demo auth: no passwords, no server. The session lives in IndexedDB so reloads stay signed in. */
export class MockAuthRepository implements AuthRepository {
	readonly #ctx: MockContext;

	constructor(ctx: MockContext) {
		this.#ctx = ctx;
	}

	/** Creates an empty account. @throws AppError CONFLICT when the email is taken. */
	signUp(request: SignUpRequest): Promise<SessionResponse> {
		return this.#ctx.request(async (db) => {
			const { name, email } = validate(SignUpRequestSchema, request);
			if (await findUser(db, email)) throw new AppError('CONFLICT', 'That email is taken');
			const user: User = {
				id: newId('u'),
				email,
				name,
				avatarSeed: email,
				createdAt: new Date(this.#ctx.now()).toISOString()
			};
			await db.put('users', user);
			await db.put('settings', { ...structuredClone(DEFAULT_SETTINGS), ownerId: user.id });
			return this.#startSession(db, user);
		});
	}

	/** Signs in a seeded or signed-up account by email. @throws AppError UNAUTHORIZED when unknown. */
	signIn(request: SignInRequest): Promise<SessionResponse> {
		return this.#ctx.request(async (db) => {
			const { email } = validate(SignInRequestSchema, request);
			const user = await findUser(db, email);
			if (!user) throw new AppError('UNAUTHORIZED', 'No account with that email');
			return this.#startSession(db, user);
		});
	}

	signOut(): Promise<void> {
		return this.#ctx.request(async (db) => {
			const session = await readSession(db);
			const accounts = session.accounts.filter((a) => a.id !== session.userId);
			const userId = accounts[0]?.id ?? null;
			await setMeta(db, 'session', { userId, accounts });
			this.#ctx.userId = userId;
		});
	}

	/** Restores the saved session on app start. */
	me(): Promise<User | null> {
		return this.#ctx.request(async (db) => {
			const { userId } = await readSession(db);
			const user = userId ? ((await db.get('users', userId)) ?? null) : null;
			this.#ctx.userId = user?.id ?? null;
			return user;
		});
	}

	listAccounts(): Promise<Account[]> {
		return this.#ctx.request(async (db) => {
			const accounts: Account[] = [];
			for (const { id, signedInAt } of (await readSession(db)).accounts) {
				const user = await db.get('users', id);
				if (user) {
					const { email, name, avatarSeed } = user;
					accounts.push({ id, email, name, avatarSeed, signedInAt });
				}
			}
			return accounts;
		});
	}

	/** @throws AppError NOT_FOUND unless the account is signed in on this device. */
	switchAccount(accountId: string): Promise<User> {
		return this.#ctx.request(async (db) => {
			const session = await readSession(db);
			const user = await db.get('users', accountId);
			if (!user || !session.accounts.some((a) => a.id === accountId)) {
				throw new AppError('NOT_FOUND', 'That account is not signed in');
			}
			await setMeta(db, 'session', { ...session, userId: accountId });
			this.#ctx.userId = accountId;
			return user;
		});
	}

	async #startSession(db: MockDb, user: User): Promise<SessionResponse> {
		const now = this.#ctx.now();
		const session = await readSession(db);
		const accounts = session.accounts.some((a) => a.id === user.id)
			? session.accounts
			: [...session.accounts, { id: user.id, signedInAt: new Date(now).toISOString() }];
		await setMeta(db, 'session', { userId: user.id, accounts });
		this.#ctx.userId = user.id;
		return {
			token: `mock-${user.id}`,
			expiresAt: new Date(now + SESSION_DAYS * 86_400_000).toISOString(),
			user
		};
	}
}

async function readSession(db: MockDb): Promise<SessionMeta> {
	return (await getMeta(db, 'session')) ?? EMPTY_SESSION;
}

async function findUser(db: MockDb, email: string): Promise<User | undefined> {
	const wanted = email.toLowerCase();
	return (await db.getAll('users')).find((u) => u.email.toLowerCase() === wanted);
}
