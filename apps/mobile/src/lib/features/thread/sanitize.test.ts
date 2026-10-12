import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import EmailBody from './EmailBody.svelte';
import { sanitizeEmail } from './sanitize.js';

describe('sanitizeEmail', () => {
	it('drops scripts, handlers, javascript: links and forms', () => {
		const { html } = sanitizeEmail(
			'<p onclick="steal()">Hi</p><script>steal()</script>' +
				'<a href="javascript:steal()">x</a><form><input name="pw"></form>'
		);
		expect(html).not.toMatch(/script|onclick|javascript:|<form|<input/);
		expect(html).toContain('<p>Hi</p>');
	});

	// Common XSS vectors (OWASP cheat sheet); none may survive with a way to run code.
	it.each([
		['svg onload', '<svg onload="steal()"><circle r="1"/></svg>'],
		['img onerror', '<img src="x" onerror="steal()">'],
		['iframe', '<iframe src="https://evil.example"></iframe>'],
		['iframe srcdoc', '<iframe srcdoc="<script>steal()</script>"></iframe>'],
		['object and embed', '<object data="evil.swf"></object><embed src="evil.swf">'],
		['mixed-case javascript: link', '<a href="JaVaScRiPt:steal()">x</a>'],
		['entity-encoded javascript: link', '<a href="&#106;avascript:steal()">x</a>'],
		['vbscript: link', '<a href="vbscript:msgbox(1)">x</a>'],
		['data:text/html link', '<a href="data:text/html,<script>steal()</script>">x</a>'],
		['meta refresh', '<meta http-equiv="refresh" content="0;url=javascript:steal()">'],
		['base href hijack', '<base href="https://evil.example/">'],
		['button formaction', '<button formaction="javascript:steal()">x</button>'],
		['math/mglyph mutation', '<math><mtext><table><mglyph><style><img src=x onerror=steal()>'],
		['noscript mutation', '<noscript><p title="</noscript><img src=x onerror=steal()>">'],
		['template contents', '<template><script>steal()</script></template>']
	])('neutralizes %s', (_name, input) => {
		const { html } = sanitizeEmail(input);
		expect(html).not.toMatch(
			/<script|<iframe|<object|<embed|<meta|<base|<button|\son\w+=|javascript:|vbscript:|data:text\/html/i
		);
	});

	it('opens links in a new tab without a referrer', () => {
		const { html } = sanitizeEmail('<a href="https://example.com">site</a>');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	it('blocks remote images and CSS urls until allowed', () => {
		const input =
			'<img src="https://t.example/pixel.gif" alt="logo"><img src="data:image/png;base64,AA==">' +
			'<div style="background: url(https://t.example/bg.png)">x</div>';
		const blocked = sanitizeEmail(input);
		expect(blocked.blockedImages).toBe(2);
		expect(blocked.html).not.toContain('t.example');
		expect(blocked.html).toContain('data:image/png');

		const shown = sanitizeEmail(input, { allowRemote: true });
		expect(shown.blockedImages).toBe(0);
		expect(shown.html).toContain('https://t.example/pixel.gif');
	});

	it('flags mail that sets a text color without a background, but not self-contained buttons', () => {
		expect(sanitizeEmail('<p style="color:#333">Dark text</p>').hasOwnColors).toBe(true);
		expect(sanitizeEmail('<table bgcolor="#fff"><tr><td>x</td></tr></table>').hasOwnColors).toBe(
			true
		);
		const button = '<a href="https://a.example" style="background:#7050f5;color:#fff">Go</a>';
		expect(sanitizeEmail(button).hasOwnColors).toBe(false);
	});
});

describe('EmailBody', () => {
	it('renders HTML in a shadow root and shows images on request', async () => {
		const { container } = render(EmailBody, {
			html: '<p>Hello</p><img src="https://t.example/a.png">',
			text: 'Hello'
		});
		const root = container.querySelector('.html')?.shadowRoot;
		expect(root?.querySelector('p')?.textContent).toBe('Hello');
		expect(root?.querySelector('img')?.hasAttribute('src')).toBe(false);

		await fireEvent.click(screen.getByRole('button', { name: 'Show images' }));
		expect(root?.querySelector('img')?.getAttribute('src')).toBe('https://t.example/a.png');
		expect(screen.queryByRole('button', { name: 'Show images' })).toBeNull();
	});

	it('falls back to plain text', () => {
		render(EmailBody, { html: null, text: 'Just text' });
		expect(screen.getByText('Just text')).toBeInTheDocument();
	});
});
