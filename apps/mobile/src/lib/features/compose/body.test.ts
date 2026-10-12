import { describe, expect, it } from 'vitest';
import { initialBody, normalizeLink, sanitizeComposeHtml, signatureHtml } from './body.js';

describe('sanitizeComposeHtml', () => {
	it('keeps basic formatting and drops scripts, handlers and styles', () => {
		const html = sanitizeComposeHtml(
			'<p style="color:red" onclick="x()"><b>Hi</b> <i>there</i><script>alert(1)</script></p><ul><li>one</li></ul><img src=x onerror=alert(1)>'
		);
		expect(html).toBe('<p><b>Hi</b> <i>there</i></p><ul><li>one</li></ul>');
	});

	it('keeps safe links with noopener and strips javascript: links', () => {
		expect(sanitizeComposeHtml('<a href="https://nem.mail">site</a>')).toBe(
			'<a href="https://nem.mail" target="_blank" rel="noopener noreferrer">site</a>'
		);
		expect(sanitizeComposeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
	});
});

describe('signature', () => {
	it('escapes the signature and keeps its line breaks', () => {
		expect(signatureHtml('Ada <CEO>\nNem')).toBe('<div>-- <br>Ada &lt;CEO&gt;<br>Nem</div>');
		expect(signatureHtml('  ')).toBe('');
	});

	it('leaves room to type above the signature', () => {
		expect(initialBody('')).toBe('');
		expect(initialBody('Ada')).toBe('<div><br></div><div><br></div><div>-- <br>Ada</div>');
	});
});

describe('normalizeLink', () => {
	it('adds a scheme and rejects unsafe ones', () => {
		expect(normalizeLink('nem.mail/about')).toBe('https://nem.mail/about');
		expect(normalizeLink('ada@example.com')).toBe('mailto:ada@example.com');
		expect(normalizeLink('http://x.com')).toBe('http://x.com');
		expect(normalizeLink('javascript:alert(1)')).toBeNull();
		expect(normalizeLink('  ')).toBeNull();
	});
});
