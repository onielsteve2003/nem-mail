/** Accents that dark ink stays readable on. Violet only appears as the corner blob. */
export const AVATAR_BASE_COLORS = ['lime', 'cyan', 'coral', 'amber'] as const;
export const AVATAR_BLOB_COLORS = ['violet', 'lime', 'cyan', 'coral', 'amber'] as const;

export type AvatarBaseColor = (typeof AVATAR_BASE_COLORS)[number];
export type AvatarBlobColor = (typeof AVATAR_BLOB_COLORS)[number];

export interface AvatarPalette {
	from: AvatarBaseColor;
	to: AvatarBaseColor;
	blob: AvatarBlobColor;
	/** Gradient direction in degrees. */
	angle: number;
	/** Blob center as percentages of the avatar box. */
	blobX: number;
	blobY: number;
}

/** 32-bit FNV-1a hash: fast, stable across sessions, and spreads short strings well. */
export function hashString(value: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** Up to two initials: first and last word, or the first letter of an email's local part. */
export function getInitials(name: string): string {
	const local = name.includes('@') ? (name.split('@')[0] ?? '') : name;
	const words = local
		.split(/[\s._-]+/)
		.map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
		.filter(Boolean);
	const first = words[0];
	if (!first) return '?';
	const last = words.length > 1 ? words[words.length - 1] : undefined;
	return ((first[0] ?? '') + (last?.[0] ?? '')).toUpperCase();
}

/** A deterministic gradient for a name, so the same sender always gets the same avatar. */
export function getAvatarPalette(name: string): AvatarPalette {
	const hash = hashString(name.trim().toLowerCase());
	const fromIndex = hash % AVATAR_BASE_COLORS.length;
	// Offset 1..3 so the two gradient stops always differ.
	const toIndex = (fromIndex + 1 + ((hash >>> 4) % 3)) % AVATAR_BASE_COLORS.length;
	return {
		from: AVATAR_BASE_COLORS[fromIndex] ?? 'lime',
		to: AVATAR_BASE_COLORS[toIndex] ?? 'cyan',
		blob: AVATAR_BLOB_COLORS[(hash >>> 8) % AVATAR_BLOB_COLORS.length] ?? 'violet',
		angle: (hash >>> 12) % 360,
		// Keep the blob in a corner (0-25% or 75-100%) so it never sits under the initials.
		blobX: (hash & (1 << 20) ? 75 : 0) + ((hash >>> 21) % 26),
		blobY: (hash & (1 << 26) ? 75 : 0) + ((hash >>> 27) % 26)
	};
}
