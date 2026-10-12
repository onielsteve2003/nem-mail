import type { Attachment } from '@nem/shared';

export type FileKind =
	'image' | 'pdf' | 'doc' | 'sheet' | 'slides' | 'archive' | 'audio' | 'video' | 'other';

const BY_EXTENSION: Record<string, FileKind> = {
	pdf: 'pdf',
	doc: 'doc',
	docx: 'doc',
	odt: 'doc',
	txt: 'doc',
	rtf: 'doc',
	xls: 'sheet',
	xlsx: 'sheet',
	ods: 'sheet',
	csv: 'sheet',
	ppt: 'slides',
	pptx: 'slides',
	odp: 'slides',
	key: 'slides',
	zip: 'archive',
	rar: 'archive',
	'7z': 'archive',
	gz: 'archive',
	tar: 'archive'
};

/** Groups a file by its MIME type, falling back to the extension when the MIME is generic. */
export function fileKind(attachment: Pick<Attachment, 'filename' | 'mime'>): FileKind {
	const mime = attachment.mime.toLowerCase();
	if (mime.startsWith('image/')) return 'image';
	if (mime.startsWith('audio/')) return 'audio';
	if (mime.startsWith('video/')) return 'video';
	if (mime === 'application/pdf') return 'pdf';
	if (mime.includes('wordprocessing') || mime === 'application/msword') return 'doc';
	if (mime.includes('spreadsheet') || mime === 'application/vnd.ms-excel') return 'sheet';
	if (mime.includes('presentation') || mime === 'application/vnd.ms-powerpoint') return 'slides';
	if (mime.includes('zip') || mime.includes('compressed')) return 'archive';
	const extension = attachment.filename.toLowerCase().split('.').pop() ?? '';
	return BY_EXTENSION[extension] ?? 'other';
}

const UNITS = ['KB', 'MB', 'GB'] as const;

/** Human file size: "820 B", "12 KB", "3.4 MB". */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit += 1;
	}
	const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
	return `${rounded} ${UNITS[unit]}`;
}

/** Saves a blob under the attachment's name through a temporary link. */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.rel = 'noopener';
	document.body.append(link);
	link.click();
	link.remove();
	// Give the browser a moment to start the download before freeing the bytes.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
