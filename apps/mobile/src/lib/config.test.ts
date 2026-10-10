import { describe, expect, it, vi } from 'vitest';
import { variables } from '../env.js';

vi.mock('$app/env/public', () => ({
	PUBLIC_DATA_SOURCE: 'mock',
	PUBLIC_API_URL: '',
	PUBLIC_APP_VERSION: '1.2.3'
}));

const { config, createConfig } = await import('./config.js');

type VarName = keyof typeof variables;

/** Runs a variable's schema the way SvelteKit does at build time. */
async function parse(name: VarName, value: string | undefined) {
	return variables[name].schema['~standard'].validate(value);
}

describe('env variables', () => {
	it('defaults the data source to mock and accepts api', async () => {
		expect(await parse('PUBLIC_DATA_SOURCE', undefined)).toEqual({ value: 'mock' });
		expect(await parse('PUBLIC_DATA_SOURCE', '  ')).toEqual({ value: 'mock' });
		expect(await parse('PUBLIC_DATA_SOURCE', 'api')).toEqual({ value: 'api' });
	});

	it('rejects an unknown data source', async () => {
		expect(await parse('PUBLIC_DATA_SOURCE', 'firebase')).toHaveProperty('issues');
	});

	it('allows an empty API URL and trims trailing slashes', async () => {
		expect(await parse('PUBLIC_API_URL', '')).toEqual({ value: '' });
		expect(await parse('PUBLIC_API_URL', 'http://localhost:5174/api/v1/')).toEqual({
			value: 'http://localhost:5174/api/v1'
		});
	});

	it('rejects a relative API URL', async () => {
		expect(await parse('PUBLIC_API_URL', '/api/v1')).toHaveProperty('issues');
	});

	it('falls back to a dev version', async () => {
		expect(await parse('PUBLIC_APP_VERSION', '')).toEqual({ value: '0.0.0-dev' });
		expect(await parse('PUBLIC_APP_VERSION', '1.0.0')).toEqual({ value: '1.0.0' });
	});
});

describe('config', () => {
	it('exposes the env values as a frozen typed object', () => {
		expect(config).toEqual({ dataSource: 'mock', apiUrl: '', appVersion: '1.2.3' });
		expect(Object.isFrozen(config)).toBe(true);
	});

	it('requires an API URL when the data source is api', () => {
		expect(() => createConfig({ dataSource: 'api', apiUrl: '', appVersion: '1.0.0' })).toThrow(
			/PUBLIC_API_URL is required/
		);
		expect(
			createConfig({ dataSource: 'api', apiUrl: 'https://api.example.com', appVersion: '1.0.0' })
		).toMatchObject({ dataSource: 'api' });
	});
});
