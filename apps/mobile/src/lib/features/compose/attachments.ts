import { MAX_ATTACHMENT_BYTES, type Attachment } from '@nem/shared';
import { formatBytes } from '#lib/utils/files.js';

/** A file in compose: still uploading, ready to send, or failed. */
export interface ComposeAttachment {
	key: string;
	filename: string;
	mime: string;
	size: number;
	status: 'uploading' | 'ready' | 'error';
	/** 0 to 1 while uploading. */
	progress: number;
	/** Set once the upload finished; this is what the draft stores. */
	attachment: Attachment | null;
	error: string | null;
}

/** The reason a file cannot be attached, or null when it can (FR-5.4). */
export function checkFile(file: Pick<File, 'size'>): string | null {
	if (file.size > MAX_ATTACHMENT_BYTES) {
		return `Over ${formatBytes(MAX_ATTACHMENT_BYTES)} (${formatBytes(file.size)})`;
	}
	return null;
}

/** A new compose entry for a picked file; files that fail checkFile start in error. */
export function pendingAttachment(file: File, key: string): ComposeAttachment {
	const error = checkFile(file);
	return {
		key,
		filename: file.name || 'attachment',
		mime: file.type || 'application/octet-stream',
		size: file.size,
		status: error ? 'error' : 'uploading',
		progress: 0,
		attachment: null,
		error
	};
}

/** An entry for an attachment that is already uploaded, such as one in a saved draft. */
export function readyAttachment(attachment: Attachment): ComposeAttachment {
	return {
		key: attachment.id,
		filename: attachment.filename,
		mime: attachment.mime,
		size: attachment.size,
		status: 'ready',
		progress: 1,
		attachment,
		error: null
	};
}

/**
 * How long the mock progress bar takes: a short base plus about 5 MB/s, so a
 * big file visibly takes longer than a small one even though the mock is local.
 */
export function mockUploadMs(size: number): number {
	return 400 + Math.round(size / 5000);
}

/** Mock progress at a point in time: eases out and holds at 95% until the upload answers. */
export function mockProgress(elapsedMs: number, size: number): number {
	const t = Math.min(1, elapsedMs / mockUploadMs(size));
	return Math.min(0.95, 1 - (1 - t) ** 2);
}

/**
 * Uploads a file while reporting mock progress. It resolves once both the
 * upload and the mock duration are done, so the bar always fills.
 */
export async function uploadWithProgress(
	file: File,
	upload: (file: File) => Promise<Attachment>,
	onprogress: (progress: number) => void,
	tickMs = 80
): Promise<Attachment> {
	const started = Date.now();
	const timer = setInterval(
		() => onprogress(mockProgress(Date.now() - started, file.size)),
		tickMs
	);
	try {
		const minimum = new Promise((resolve) => setTimeout(resolve, mockUploadMs(file.size)));
		const [attachment] = await Promise.all([upload(file), minimum]);
		onprogress(1);
		return attachment;
	} finally {
		clearInterval(timer);
	}
}

/** The uploaded attachments, in the order they were added. */
export function uploaded(list: ComposeAttachment[]): Attachment[] {
	return list.flatMap((item) => (item.attachment ? [item.attachment] : []));
}
