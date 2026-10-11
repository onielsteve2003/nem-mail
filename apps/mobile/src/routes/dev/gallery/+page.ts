import { dev } from '$app/env';
import { error } from '@sveltejs/kit';

// The component gallery is a development tool; production builds answer 404.
export function load() {
	if (!dev) error(404, 'Not found');
}
