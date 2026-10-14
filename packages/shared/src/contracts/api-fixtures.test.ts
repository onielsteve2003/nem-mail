import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENDPOINTS, type EndpointName } from './endpoints';
import { ApiErrorSchema } from './errors';

/**
 * Responses recorded from the Java API by ApiContractFixturesTest
 * (`./gradlew test -PwriteApiFixtures` in apps/api), parsed with the same schemas the client uses.
 */
const DIR = new URL('../../fixtures/api/', import.meta.url);
const files = readdirSync(DIR).filter((name) => name.endsWith('.json'));
const read = (file: string): unknown => JSON.parse(readFileSync(new URL(file, DIR), 'utf8'));

/** Endpoints later backend tasks add (M18 AI) or not yet served. */
const NOT_YET_SERVED: readonly EndpointName[] = [
	'aiSummary',
	'aiReplies',
	'aiAssistant',
	'aiFeedback'
];

/** Served, but not as JSON: file bytes and the SSE stream (AttachmentTest, EventStreamTest). */
const NOT_JSON: readonly EndpointName[] = ['getAttachment', 'events'];

describe('API contract fixtures', () => {
	const endpoints = files.filter((file) => !file.startsWith('error.'));

	it.each(endpoints)('%s parses with its endpoint response schema', (file) => {
		const name = file.replace(/\.json$/, '');
		expect(name in ENDPOINTS, `${name} is not an ENDPOINTS key`).toBe(true);
		const result = ENDPOINTS[name as EndpointName].response.safeParse(read(file));
		expect(result.error?.issues ?? []).toEqual([]);
	});

	it.each(files.filter((file) => file.startsWith('error.')))('%s is the error envelope', (file) => {
		expect(ApiErrorSchema.safeParse(read(file)).error?.issues ?? []).toEqual([]);
	});

	it('covers every served endpoint', () => {
		const served = (Object.keys(ENDPOINTS) as EndpointName[]).filter(
			(name) => !NOT_YET_SERVED.includes(name) && !NOT_JSON.includes(name)
		);
		expect(endpoints.map((file) => file.replace(/\.json$/, '')).sort()).toEqual(served.sort());
	});
});
