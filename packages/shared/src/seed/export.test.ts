import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SEED_EXPORT_NOW, generateSeed } from './index';

describe('fixtures/seed.json', () => {
	it('matches the generator, so the API seeds the same mail as the mock', () => {
		const file = new URL('../../fixtures/seed.json', import.meta.url);
		const exported: unknown = JSON.parse(readFileSync(file, 'utf8'));
		// JSON round trip drops undefined fields the same way the export did.
		const expected: unknown = JSON.parse(JSON.stringify(generateSeed({ now: SEED_EXPORT_NOW })));
		expect(exported, 'run `npm run seed:export -w packages/shared`').toEqual(expected);
	});
});
