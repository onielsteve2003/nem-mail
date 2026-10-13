import { openDB, type IDBPDatabase } from 'idb';

/** Where learned models are saved on this device, keyed `<userId>:<kind>` (one model per account). */
export interface ModelStore {
	get(key: string): Promise<unknown>;
	put(key: string, value: unknown): Promise<void>;
	delete(key: string): Promise<void>;
}

/** A cached sentence embedding and a hash of the text it was computed from. */
export interface EmbeddingEntry {
	hash: string;
	vector: number[];
}

/** Embeddings for semantic search (AI-7), keyed `<userId>:<threadId>`. */
export interface EmbeddingStore {
	getMany(keys: string[]): Promise<(EmbeddingEntry | undefined)[]>;
	putMany(entries: [key: string, entry: EmbeddingEntry][]): Promise<void>;
}

const DB_NAME = 'nem-ai';
const DB_VERSION = 2;
const STORE = 'models';
const EMBEDDINGS = 'embeddings';

const databases = new Map<string, Promise<IDBPDatabase>>();

/** Version 2 added the embeddings store; models saved under version 1 are kept. */
function open(name: string): Promise<IDBPDatabase> {
	let db = databases.get(name);
	if (!db) {
		db = openDB(name, DB_VERSION, {
			upgrade(database) {
				for (const store of [STORE, EMBEDDINGS]) {
					if (!database.objectStoreNames.contains(store)) database.createObjectStore(store);
				}
			}
		});
		databases.set(name, db);
	}
	return db;
}

/**
 * IndexedDB model store, separate from the mail database so the AI worker can open it
 * on its own and Phase 2 can drop it for the server's `ml_models` table.
 */
export function idbModelStore(name = DB_NAME): ModelStore {
	return {
		get: async (key) => (await open(name)).get(STORE, key),
		put: async (key, value) => void (await (await open(name)).put(STORE, value, key)),
		delete: async (key) => (await open(name)).delete(STORE, key)
	};
}

/** IndexedDB embedding cache; Phase 2 replaces it with pgvector on the server. */
export function idbEmbeddingStore(name = DB_NAME): EmbeddingStore {
	return {
		async getMany(keys) {
			const tx = (await open(name)).transaction(EMBEDDINGS);
			return Promise.all(keys.map((key) => tx.store.get(key)));
		},
		async putMany(entries) {
			const tx = (await open(name)).transaction(EMBEDDINGS, 'readwrite');
			await Promise.all([...entries.map(([key, entry]) => tx.store.put(entry, key)), tx.done]);
		}
	};
}
