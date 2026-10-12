import { describe, expect, it } from 'vitest';
import { fileKind, formatBytes } from './files.js';

describe('fileKind', () => {
	it.each([
		['IMG_1.jpg', 'image/jpeg', 'image'],
		['brief.pdf', 'application/pdf', 'pdf'],
		[
			'notes.docx',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'doc'
		],
		['budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'sheet'],
		[
			'deck.pptx',
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			'slides'
		],
		['bundle.zip', 'application/zip', 'archive'],
		['song.mp3', 'audio/mpeg', 'audio'],
		['clip.mp4', 'video/mp4', 'video'],
		['data.csv', 'application/octet-stream', 'sheet'],
		['mystery', 'application/octet-stream', 'other']
	] as const)('%s (%s) is %s', (filename, mime, kind) => {
		expect(fileKind({ filename, mime })).toBe(kind);
	});
});

describe('formatBytes', () => {
	it('picks a readable unit', () => {
		expect(formatBytes(820)).toBe('820 B');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(40 * 1024)).toBe('40 KB');
		expect(formatBytes(3.4 * 1024 * 1024)).toBe('3.4 MB');
	});
});
