import createDOMPurify from 'dompurify';

/** What the reader renders for one message body (FR-4.3, FR-4.7). */
export interface SafeEmail {
	html: string;
	/** Remote images (img src, srcset, CSS url()) held back until the user taps "Show images". */
	blockedImages: number;
	/**
	 * The email sets its own text or background colors, so dark mode shows it on
	 * a light sheet instead of recoloring it (dark text on a dark page would vanish).
	 */
	hasOwnColors: boolean;
}

// Forms and buttons inside mail are a phishing tool; nothing in a read view needs them.
const FORBID_TAGS = ['form', 'input', 'button', 'textarea', 'select', 'option', 'base', 'meta'];
const REMOTE_URL = /^(?:https?:)?\/\//i;
const CSS_REMOTE_URL = /url\(\s*(['"]?)\s*(?:https?:)?\/\/[^)]*\1\s*\)/gi;

const purify = createDOMPurify(window);
// Per-call state for the hooks; sanitizeEmail runs synchronously, so calls never overlap.
let state = { allowRemote: false, blocked: 0, hasOwnColors: false };

function blockCssUrls(css: string): string {
	return css.replace(CSS_REMOTE_URL, () => {
		state.blocked++;
		return 'none';
	});
}

purify.addHook('uponSanitizeElement', (node, data) => {
	if (data.tagName === 'style' && !state.allowRemote && node.textContent) {
		node.textContent = blockCssUrls(node.textContent);
	}
});

purify.addHook('afterSanitizeAttributes', (node) => {
	if (!(node instanceof HTMLElement)) return;
	if (node instanceof HTMLAnchorElement && node.hasAttribute('href')) {
		node.setAttribute('target', '_blank');
		node.setAttribute('rel', 'noopener noreferrer');
	}
	if (!state.allowRemote) {
		if (node instanceof HTMLImageElement) {
			const src = node.getAttribute('src') ?? '';
			if (REMOTE_URL.test(src) || node.hasAttribute('srcset')) {
				node.removeAttribute('src');
				node.removeAttribute('srcset');
				state.blocked++;
			}
		}
		if (node.hasAttribute('background')) {
			node.removeAttribute('background');
			state.blocked++;
		}
		const style = node.getAttribute('style');
		if (style) node.setAttribute('style', blockCssUrls(style));
	}
	const hasColor = !!node.style.color || node.hasAttribute('color');
	const hasBackground =
		!!node.style.backgroundColor || !!node.style.background || node.hasAttribute('bgcolor');
	// A button that sets both stays readable on any page; one without the other may not.
	if (hasColor !== hasBackground) state.hasOwnColors = true;
});

/**
 * Sanitizes untrusted email HTML with DOMPurify: no scripts, handlers or forms,
 * links open in a new tab without a referrer, and remote images are blocked
 * unless `allowRemote` is set.
 */
export function sanitizeEmail(html: string, { allowRemote = false } = {}): SafeEmail {
	state = { allowRemote, blocked: 0, hasOwnColors: false };
	const clean = purify.sanitize(html, { FORBID_TAGS, WHOLE_DOCUMENT: false });
	return { html: clean, blockedImages: state.blocked, hasOwnColors: state.hasOwnColors };
}
