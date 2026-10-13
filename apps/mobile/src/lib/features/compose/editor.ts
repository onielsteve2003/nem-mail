/** Toolbar commands that toggle and show a pressed state. */
export type FormatCommand = 'bold' | 'italic' | 'insertUnorderedList' | 'insertOrderedList';

const FORMAT_COMMANDS: FormatCommand[] = [
	'bold',
	'italic',
	'insertUnorderedList',
	'insertOrderedList'
];

/*
 * execCommand is deprecated but still the only API every browser supports for
 * contenteditable formatting with native undo; a rich-text library would be far
 * heavier than four buttons need. Wrapped here so it is used in one place.
 */

/** Runs one editing command on the current selection. */
export function runCommand(
	command: FormatCommand | 'createLink' | 'insertHTML' | 'insertText',
	value?: string
): void {
	document.execCommand(command, false, value);
}

/** Which formats are on at the caret, for the toolbar's pressed states. */
export function formatState(): Record<FormatCommand, boolean> {
	const read = (command: FormatCommand) => {
		try {
			return document.queryCommandState(command);
		} catch {
			return false;
		}
	};
	return Object.fromEntries(FORMAT_COMMANDS.map((c) => [c, read(c)])) as Record<
		FormatCommand,
		boolean
	>;
}
