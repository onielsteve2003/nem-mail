import {
	DEFAULT_SEED,
	generateSeed,
	type Contact,
	type Draft,
	type Label,
	type SeedData,
	type SeedOptions,
	type Settings,
	type Thread,
	type User
} from '@nem/shared';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export const DB_NAME = 'nem-mail';
/** Bump with a new branch in `upgrade` whenever a store or index changes. */
export const DB_VERSION = 1;

/** A record that belongs to one demo account. */
export type Owned<T> = T & { ownerId: string };

/** Which seed is in the database, so a reload never re-seeds over the user's changes. */
export interface SeedMeta {
	seed: string;
	seededAt: string;
}

/** Demo sign-in state: the active account and every account signed in on this device. */
export interface SessionMeta {
	userId: string | null;
	accounts: { id: string; signedInAt: string }[];
}

export interface MetaValues {
	seed: SeedMeta;
	session: SessionMeta;
}

export interface NemDB extends DBSchema {
	meta: { key: keyof MetaValues; value: MetaValues[keyof MetaValues] };
	users: { key: string; value: User };
	threads: { key: string; value: Owned<Thread>; indexes: { byOwner: string } };
	labels: { key: string; value: Owned<Label>; indexes: { byOwner: string } };
	contacts: { key: string; value: Owned<Contact>; indexes: { byOwner: string } };
	drafts: { key: string; value: Owned<Draft>; indexes: { byOwner: string } };
	settings: { key: string; value: Owned<Settings> };
	/**
	 * Attachment bytes by attachment id (uploads); seed attachments have none.
	 * Stored as an ArrayBuffer because some WebKit builds cannot put a Blob in
	 * IndexedDB; older entries may still be Blobs.
	 */
	blobs: { key: string; value: StoredBytes | Blob };
}

export type MockDb = IDBPDatabase<NemDB>;

/** An uploaded file's bytes and MIME type. */
export interface StoredBytes {
	bytes: ArrayBuffer;
	type: string;
}

const OWNED_STORES = ['threads', 'labels', 'contacts', 'drafts'] as const;
const ALL_STORES = ['meta', 'users', ...OWNED_STORES, 'settings', 'blobs'] as const;

/** Opens (and creates or upgrades) the mock backend database. */
export function openMockDb(name: string = DB_NAME): Promise<MockDb> {
	return openDB<NemDB>(name, DB_VERSION, {
		upgrade(db, oldVersion) {
			if (oldVersion < 1) {
				db.createObjectStore('meta');
				db.createObjectStore('users', { keyPath: 'id' });
				for (const store of OWNED_STORES) {
					db.createObjectStore(store, { keyPath: 'id' }).createIndex('byOwner', 'ownerId');
				}
				db.createObjectStore('settings', { keyPath: 'ownerId' });
				db.createObjectStore('blobs');
			}
		}
	});
}

/** Reads a typed value from the meta store. */
export async function getMeta<K extends keyof MetaValues>(
	db: MockDb,
	key: K
): Promise<MetaValues[K] | undefined> {
	return (await db.get('meta', key)) as MetaValues[K] | undefined;
}

/** Writes a typed value to the meta store. */
export async function setMeta<K extends keyof MetaValues>(
	db: MockDb,
	key: K,
	value: MetaValues[K]
): Promise<void> {
	await db.put('meta', value, key);
}

/**
 * Writes the seed on first run, or again when the demo seed itself changed
 * (a new DEFAULT_SEED). Returns true when it seeded, false when data was already there.
 */
export async function seedIfEmpty(db: MockDb, options: SeedOptions = {}): Promise<boolean> {
	if ((await getMeta(db, 'seed'))?.seed === (options.seed ?? DEFAULT_SEED)) return false;
	await writeSeed(db, generateSeed(options));
	return true;
}

/**
 * Wipes every store and writes a fresh seed (Settings → "Reset demo data"). Signed-in
 * demo accounts stay signed in; accounts created since the last seed are gone.
 */
export async function resetToSeed(db: MockDb, options: SeedOptions = {}): Promise<void> {
	const data = generateSeed(options);
	const session = await getMeta(db, 'session');
	await writeSeed(db, data);
	if (!session) return;
	const seeded = new Set(data.accounts.map((account) => account.user.id));
	const accounts = session.accounts.filter((account) => seeded.has(account.id));
	const userId =
		session.userId && seeded.has(session.userId) ? session.userId : (accounts[0]?.id ?? null);
	await setMeta(db, 'session', { userId, accounts });
}

/** Clears all stores and writes `data` in one transaction, so a failed seed leaves nothing half-written. */
async function writeSeed(db: MockDb, data: SeedData): Promise<void> {
	const tx = db.transaction(ALL_STORES, 'readwrite');
	const writes: Promise<unknown>[] = ALL_STORES.map((store) => tx.objectStore(store).clear());
	for (const account of data.accounts) {
		const ownerId = account.user.id;
		writes.push(tx.objectStore('users').put(account.user));
		writes.push(tx.objectStore('settings').put({ ...account.settings, ownerId }));
		for (const thread of account.threads) {
			writes.push(tx.objectStore('threads').put({ ...thread, ownerId }));
		}
		for (const label of account.labels) {
			writes.push(tx.objectStore('labels').put({ ...label, ownerId }));
		}
		for (const contact of account.contacts) {
			writes.push(tx.objectStore('contacts').put({ ...contact, ownerId }));
		}
		for (const draft of account.drafts) {
			writes.push(tx.objectStore('drafts').put({ ...draft, ownerId }));
		}
	}
	writes.push(tx.objectStore('meta').put({ seed: data.seed, seededAt: data.generatedAt }, 'seed'));
	await Promise.all([...writes, tx.done]);
}

/** Drops the storage-only `ownerId` before a record leaves the data layer. */
export function stripOwner<T extends object>(record: Owned<T>): T {
	const rest: Partial<Owned<T>> = { ...record };
	delete rest.ownerId;
	return rest as T;
}

let shared: Promise<MockDb> | undefined;

/** The app-wide database, opened and seeded once per page load. */
export function getMockDb(): Promise<MockDb> {
	shared ??= openMockDb().then(async (db) => {
		await seedIfEmpty(db);
		return db;
	});
	return shared;
}
