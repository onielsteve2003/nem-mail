import { describe, expect, it, vi } from 'vitest';
import { variables } from '../env.js';
import pkg from '../../package.json' with { type: 'json' };

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
	it('leaves a blank data source unset and accepts api', async () => {
		expect(await parse('PUBLIC_DATA_SOURCE', undefined)).toEqual({ value: '' });
		expect(await parse('PUBLIC_DATA_SOURCE', '  ')).toEqual({ value: '' });
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

	it('falls back to the package.json version', async () => {
		expect(await parse('PUBLIC_APP_VERSION', '')).toEqual({ value: pkg.version });
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

	it('defaults to the API when there is an API URL, else to the mock', () => {
		const version = { appVersion: '1.0.0' };
		expect(
			createConfig({ dataSource: '', apiUrl: 'https://api.example.com', ...version })
		).toMatchObject({ dataSource: 'api' });
		expect(createConfig({ dataSource: '', apiUrl: '', ...version })).toMatchObject({
			dataSource: 'mock'
		});
		expect(
			createConfig({ dataSource: 'mock', apiUrl: 'https://api.example.com', ...version })
		).toMatchObject({ dataSource: 'mock' });
	});
});
