import createDOMPurify from 'dompurify';

// Only what the toolbar can make, plus the blocks browsers insert on Enter and quotes (T7.4).
const ALLOWED_TAGS = [
	'b',
	'strong',
	'i',
	'em',
	'u',
	'ul',
	'ol',
	'li',
	'a',
	'br',
	'p',
	'div',
	'span',
	'blockquote'
];
const ALLOWED_ATTR = ['href'];
const SAFE_LINK = /^(?:https?:|mailto:)/i;
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;

const purify = createDOMPurify(window);
purify.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName !== 'A') return;
	const href = node.getAttribute('href') ?? '';
	if (!SAFE_LINK.test(href)) node.removeAttribute('href');
	else {
		node.setAttribute('target', '_blank');
		node.setAttribute('rel', 'noopener noreferrer');
	}
});

/**
 * Cleans the editor's HTML (and pasted HTML) down to basic formatting: no
 * styles, classes, scripts or handlers, and links only to http(s) or mailto.
 */
export function sanitizeComposeHtml(html: string): string {
	return purify.sanitize(html, {
		ALLOWED_TAGS,
		ALLOWED_ATTR: [...ALLOWED_ATTR, 'target', 'rel']
	});
}

/** Escapes plain text for HTML, keeping line breaks. */
export function textToHtml(text: string): string {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML.replace(/\r?\n/g, '<br>');
}

/** The signature block (FR-5.8): the `-- ` delimiter mail clients recognise, then the text. */
export function signatureHtml(signature: string): string {
	return signature.trim() ? `<div>-- <br>${textToHtml(signature.trim())}</div>` : '';
}

/** A new message's starting body: an empty line to type on, then the signature. */
export function initialBody(signature: string): string {
	const block = signatureHtml(signature);
	return block ? `<div><br></div><div><br></div>${block}` : '';
}

/**
 * Turns what the user typed into a link: adds https:// when there is no scheme,
 * mailto: for a bare email, and returns null for anything unsafe (javascript:).
 */
export function normalizeLink(input: string): string | null {
	const url = input.trim();
	if (!url) return null;
	if (HAS_SCHEME.test(url)) return SAFE_LINK.test(url) ? url : null;
	if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
	return `https://${url}`;
}

/**
 * The words the user wrote, as plain text with a line per paragraph: quoted mail is
 * dropped, so smart compose learns only from the user's own writing.
 */
export function ownBodyText(html: string): string {
	const doc = new DOMParser().parseFromString(sanitizeComposeHtml(html), 'text/html');
	doc.querySelectorAll('blockquote').forEach((quote) => quote.remove());
	doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
	doc.querySelectorAll('div, p, li').forEach((block) => block.append('\n'));
	return doc.body.textContent ?? '';
}
