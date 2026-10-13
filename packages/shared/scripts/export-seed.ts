/**
 * Writes the demo seed to fixtures/seed.json for the Java API's SeedRunner, so the
 * mock and the API serve the same mail. `now` is fixed so the file only changes
 * when the generator does; the API shifts every timestamp to its own clock.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_EXPORT_NOW, generateSeed } from '../src/seed';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/seed.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(generateSeed({ now: SEED_EXPORT_NOW })) + '\n');
console.log(`Wrote ${out}`);
