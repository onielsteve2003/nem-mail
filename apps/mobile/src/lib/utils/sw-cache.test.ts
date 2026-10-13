import { describe, expect, it } from 'vitest';
import { SHELL_PATH, cacheStrategy, precacheList } from './sw-cache.js';

const ORIGIN = 'https://nem-mail.vercel.app';
const precached = new Set(['/_app/immutable/app.js', '/icons/icon-192.png']);
const get = (path: string, mode = 'cors', origin = ORIGIN) => ({
	method: 'GET',
	mode,
	url: new URL(path, origin)
});

describe('precacheList', () => {
	it('stores the build, the static files and the shell as root paths, without the iOS launch images', () => {
		const list = precacheList(
			['_app/immutable/app.js'],
			['manifest.webmanifest', '/icons/icon-192.png', 'icons/splash/splash-750x1334.png']
		);
		expect(list).toEqual([
			'/_app/immutable/app.js',
			'/manifest.webmanifest',
			'/icons/icon-192.png',
			SHELL_PATH
		]);
	});
});

describe('cacheStrategy', () => {
	it('serves page loads from the shell', () => {
		expect(cacheStrategy(get('/mail/inbox', 'navigate'), ORIGIN, precached)).toBe('shell');
	});

	it('serves precached files from the cache', () => {
		expect(cacheStrategy(get('/_app/immutable/app.js'), ORIGIN, precached)).toBe('cache-first');
	});

	it('tries the network first for other same-origin files', () => {
		expect(cacheStrategy(get('/robots.txt'), ORIGIN, precached)).toBe('network-first');
	});

	it('leaves cross-origin and non-GET requests alone', () => {
		expect(
			cacheStrategy(get('/model.onnx', 'cors', 'https://huggingface.co'), ORIGIN, precached)
		).toBeNull();
		expect(cacheStrategy({ ...get('/x'), method: 'POST' }, ORIGIN, precached)).toBeNull();
	});
});
