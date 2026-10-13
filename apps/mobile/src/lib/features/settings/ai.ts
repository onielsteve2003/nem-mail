import type { AIFeature } from '@nem/shared';

export interface AIFeatureCopy {
	feature: AIFeature;
	name: string;
	/** What turning it off changes, in plain words. */
	description: string;
}

/** Every AI feature (PRD 6.8) in the order the AI settings list them. */
export const AI_FEATURE_COPY: readonly AIFeatureCopy[] = [
	{
		feature: 'categories',
		name: 'Inbox categories',
		description: 'Sorts mail into Primary, Promotions, Social, Updates and Forums'
	},
	{
		feature: 'spam',
		name: 'Spam and phishing',
		description: 'Flags junk and suspicious mail and explains why'
	},
	{
		feature: 'priority',
		name: 'Priority',
		description: 'Marks important mail and adds the Priority sort'
	},
	{
		feature: 'summary',
		name: 'Thread summaries',
		description: 'A short summary with action items on long conversations'
	},
	{
		feature: 'smartReply',
		name: 'Smart replies',
		description: 'Quick reply chips under a message'
	},
	{
		feature: 'smartCompose',
		name: 'Smart compose',
		description: 'Suggests the rest of your sentence as you write'
	},
	{
		feature: 'toneCheck',
		name: 'Tone check',
		description: 'Warns before you send a message that may read as harsh'
	},
	{
		feature: 'semanticSearch',
		name: 'Semantic search',
		description: 'Finds mail by meaning, not only by matching words'
	},
	{
		feature: 'extraction',
		name: 'Smart extraction',
		description: 'Action chips for codes, tracking numbers, dates and meetings'
	},
	{
		feature: 'followUp',
		name: 'Follow-up nudges',
		description: 'Reminds you about sent mail that got no reply'
	},
	{
		feature: 'unsubscribe',
		name: 'Unsubscribe suggestions',
		description: 'Points out newsletters you never open'
	},
	{
		feature: 'assistant',
		name: 'Assistant',
		description: 'Summarize unread, find what needs a reply, draft replies'
	}
];
