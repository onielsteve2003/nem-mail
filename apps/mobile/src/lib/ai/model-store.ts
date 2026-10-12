import { openDB, type IDBPDatabase } from 'idb';

/** Where learned models are saved on this device, keyed `<userId>:<kind>` (one model per account). */
export interface ModelStore {
	get(key: string): Promise<unknown>;
	put(key: string, value: unknown): Promise<void>;
}

const DB_NAME = 'nem-ai';
const STORE = 'models';

/**
 * IndexedDB model store, separate from the mail database so the AI worker can open it
 * on its own and Phase 2 can drop it for the server's `ml_models` table.
 */
export function idbModelStore(name = DB_NAME): ModelStore {
	let db: Promise<IDBPDatabase> | undefined;
	const open = () =>
		(db ??= openDB(name, 1, {
			upgrade: (database) => void database.createObjectStore(STORE)
		}));
	return {
		get: async (key) => (await open()).get(STORE, key),
		put: async (key, value) => void (await (await open()).put(STORE, value, key))
	};
}
