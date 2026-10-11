/** Seeded random numbers: the same seed always gives the same sequence. */
export interface Rng {
	/** A float in [0, 1). */
	next(): number;
	/** An integer in [min, max], both inclusive. */
	int(min: number, max: number): number;
	chance(probability: number): boolean;
	pick<T>(items: readonly T[]): T;
	/** `count` distinct items, in random order. */
	sample<T>(items: readonly T[], count: number): T[];
}

/** FNV-1a: turns a string seed into a 32-bit number. */
export function hashSeed(seed: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		hash ^= seed.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** Mulberry32: small, fast and good enough for demo data (not for security). */
export function createRng(seed: string): Rng {
	let state = hashSeed(seed);
	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
	const pick = <T>(items: readonly T[]): T => {
		if (items.length === 0) throw new Error('Cannot pick from an empty list');
		return items[int(0, items.length - 1)] as T;
	};
	const sample = <T>(items: readonly T[], count: number): T[] => {
		const pool = [...items];
		for (let i = pool.length - 1; i > 0; i--) {
			const j = int(0, i);
			[pool[i], pool[j]] = [pool[j] as T, pool[i] as T];
		}
		return pool.slice(0, Math.min(count, pool.length));
	};
	return { next, int, chance: (probability) => next() < probability, pick, sample };
}
