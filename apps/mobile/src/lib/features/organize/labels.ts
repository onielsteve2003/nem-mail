import { LABEL_NAME_MAX, type Label } from '@nem/shared';

export const LABEL_COPY = {
	empty: 'Enter a name',
	tooLong: `Use ${LABEL_NAME_MAX} characters or fewer`,
	taken: 'A label with that name is already here',
	noParent: 'Pick a label that is not nested'
};

export interface LabelFields {
	name: string;
	parentId: string | null;
}

/**
 * Why the label cannot be saved, or null when it can (FR-2.4). Mirrors the
 * repository rules so most mistakes show under the field before a round trip:
 * names unique among siblings ignoring case, and one level of nesting.
 */
export function labelProblem(
	fields: LabelFields,
	labels: readonly Label[],
	editingId: string | null = null
): string | null {
	const name = fields.name.trim();
	if (!name) return LABEL_COPY.empty;
	if (name.length > LABEL_NAME_MAX) return LABEL_COPY.tooLong;
	const others = labels.filter((label) => label.id !== editingId);
	const lower = name.toLowerCase();
	if (others.some((l) => l.parentId === fields.parentId && l.name.toLowerCase() === lower)) {
		return LABEL_COPY.taken;
	}
	if (fields.parentId !== null) {
		const parent = others.find((label) => label.id === fields.parentId);
		if (!parent || parent.parentId !== null) return LABEL_COPY.noParent;
	}
	return null;
}

/**
 * Labels the edited label may nest under: top-level labels other than itself.
 * A label that has children cannot nest, since labels go one level deep.
 */
export function parentChoices(labels: readonly Label[], editingId: string | null = null): Label[] {
	if (editingId && labels.some((label) => label.parentId === editingId)) return [];
	return labels
		.filter((label) => label.parentId === null && label.id !== editingId)
		.sort((a, b) => a.name.localeCompare(b.name));
}
