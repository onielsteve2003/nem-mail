import type { Category } from '../schemas/mailbox';
import type { LabelColor } from '../schemas/label';

/*
 * Fictional people, brands and mail text for the demo inbox. Domains use the reserved
 * `.example` TLD or example.com/org/net, so no address belongs to anyone real.
 * `{name}` placeholders are filled by the generator.
 */

export const FIRST_NAMES = [
	'Amara',
	'Bayo',
	'Chidi',
	'Dana',
	'Eli',
	'Femi',
	'Grace',
	'Hana',
	'Ibrahim',
	'Jonas',
	'Kemi',
	'Leila',
	'Mateo',
	'Nia',
	'Omar',
	'Priya',
	'Quinn',
	'Rosa',
	'Sade',
	'Tariq',
	'Uche',
	'Vera',
	'Wale',
	'Xin',
	'Yara',
	'Zane',
	'Ada',
	'Bruno',
	'Chioma',
	'Diego'
] as const;

export const LAST_NAMES = [
	'Adeyemi',
	'Bello',
	'Costa',
	'Dubois',
	'Eze',
	'Fischer',
	'Garcia',
	'Haddad',
	'Ito',
	'Jensen',
	'Kowalski',
	'Lindqvist',
	'Mensah',
	'Nakamura',
	'Okafor',
	'Petrov',
	'Quist',
	'Rossi',
	'Sato',
	'Tanaka',
	'Usman',
	'Varga',
	'Wright',
	'Yilmaz'
] as const;

export const CONTACT_DOMAINS = [
	'example.com',
	'example.org',
	'example.net',
	'northwind.example',
	'brightlane.example',
	'kora.example'
] as const;

export interface SeedLabelDef {
	key: string;
	name: string;
	color: LabelColor;
	parent?: string;
}

export const LABEL_DEFS: readonly SeedLabelDef[] = [
	{ key: 'work', name: 'Work', color: 'violet' },
	{ key: 'projects', name: 'Projects', color: 'coral', parent: 'work' },
	{ key: 'personal', name: 'Personal', color: 'lime' },
	{ key: 'family', name: 'Family', color: 'neutral', parent: 'personal' },
	{ key: 'travel', name: 'Travel', color: 'cyan' },
	{ key: 'receipts', name: 'Receipts', color: 'amber' }
];

export const VOCAB = {
	project: [
		'Aurora redesign',
		'Q4 roadmap',
		'onboarding flow',
		'search revamp',
		'billing migration',
		'mobile launch'
	],
	place: ['Lisbon', 'Lagos', 'Kyoto', 'Accra', 'Barcelona', 'Nairobi', 'Oslo', 'Cape Town'],
	day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
	time: ['9:30', '11:00', '13:15', '15:00', '16:30', '18:00'],
	product: [
		'wireless earbuds',
		'running shoes',
		'desk lamp',
		'linen shirt',
		'coffee grinder',
		'travel backpack'
	],
	topic: [
		'state management',
		'accessibility audits',
		'offline sync',
		'CSS container queries',
		'service workers',
		'type-safe APIs'
	],
	dish: ['jollof', 'ramen', 'paella', 'tacos', 'suya', 'curry']
} as const;
export type VocabKey = keyof typeof VOCAB;

export interface AttachmentDef {
	filename: string;
	mime: string;
}

export const ATTACHMENTS: Record<string, AttachmentDef> = {
	pdf: { filename: '{project}-brief.pdf', mime: 'application/pdf' },
	invoice: { filename: 'invoice-{number}.pdf', mime: 'application/pdf' },
	photo: { filename: 'IMG_{number}.jpg', mime: 'image/jpeg' },
	screenshot: { filename: 'screenshot-{number}.png', mime: 'image/png' },
	doc: {
		filename: 'notes-{day}.docx',
		mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	},
	sheet: {
		filename: 'budget-{number}.xlsx',
		mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	},
	ticket: { filename: 'boarding-pass-{place}.pdf', mime: 'application/pdf' }
};

/** A personal conversation: an opener and the replies that may follow. */
export interface ConversationDef {
	subject: string;
	opener: string[];
	replies: string[];
	labels?: string[];
	attachment?: string;
}

export const CONVERSATIONS: readonly ConversationDef[] = [
	{
		subject: 'Notes from today on the {project}',
		opener: [
			'Hi {to},',
			'Quick recap from our call: we agreed to ship the first slice by {day} and keep the scope tight.',
			'Can you look over the brief and flag anything missing?'
		],
		replies: [
			'Thanks, looks good. I added two comments on the timeline.',
			'One question: who owns the copy review?',
			'Works for me. Let us sync again on {day} at {time}.'
		],
		labels: ['work', 'projects'],
		attachment: 'pdf'
	},
	{
		subject: 'Lunch {day}?',
		opener: [
			'Hey {to}!',
			'Are you free for lunch on {day}? There is a new {dish} place near the office I have been meaning to try.'
		],
		replies: [
			'Yes please! {time} works.',
			'Can we push it to {time}? I have a call just before.',
			'Perfect, see you there.'
		],
		labels: ['personal']
	},
	{
		subject: 'Trip to {place}',
		opener: [
			'Hi {to},',
			'I found flights to {place} for the long weekend. The hotel is close to the old town and has a rooftop.',
			'Want me to book for both of us?'
		],
		replies: [
			'Do it! I will send you my share tonight.',
			'Can we leave a day later? I have a deadline on {day}.',
			'Booked. Boarding passes attached.'
		],
		labels: ['travel', 'personal'],
		attachment: 'ticket'
	},
	{
		subject: 'Review: {topic} proposal',
		opener: [
			'Hi {to},',
			'I drafted a short proposal on {topic} for the team. It is a two-page read.',
			'Would love your honest feedback before Thursday.'
		],
		replies: [
			'Read it. The direction is right, but section 2 needs numbers.',
			'Strong proposal. I would cut the appendix.',
			'Left inline comments. Happy to pair on it.'
		],
		labels: ['work'],
		attachment: 'doc'
	},
	{
		subject: 'Photos from the weekend',
		opener: ['{to}!', 'Here are the photos from Saturday. The sunset one is my favourite.'],
		replies: [
			'These are lovely, thank you!',
			'Can you send the full-size version of the group photo?',
			'Framing the sunset one.'
		],
		labels: ['family'],
		attachment: 'photo'
	},
	{
		subject: 'Budget for {project}',
		opener: [
			'Hi {to},',
			'Attached is the updated budget. We are about 8% over on contractors.',
			'Can we talk about where to trim?'
		],
		replies: [
			'I can free up some budget from tooling.',
			'Let us move the extra spend to next quarter.',
			'Approved with the changes we discussed.'
		],
		labels: ['work'],
		attachment: 'sheet'
	},
	{
		subject: 'Bug in the {project} build',
		opener: [
			'Hey {to},',
			'The latest build crashes when you open settings twice. Screenshot attached.',
			'Can you take a look today?'
		],
		replies: [
			'On it. Looks like a race in the store init.',
			'Fixed in the latest commit, can you retest?',
			'Confirmed fixed. Thanks!'
		],
		labels: ['work', 'projects'],
		attachment: 'screenshot'
	},
	{
		subject: 'Catching up',
		opener: [
			'Hi {to},',
			'It has been ages. How is the new job going? Would love to hear everything.'
		],
		replies: [
			'So good to hear from you! It is busy but fun.',
			'Let us call this weekend.',
			'Miss you too. {day} evening?'
		],
		labels: ['personal']
	},
	{
		subject: 'Interview loop for {day}',
		opener: [
			'Hi {to},',
			'You are on the interview panel on {day} at {time}. The candidate profile is attached.'
		],
		replies: [
			'Got it, I will prepare the system design round.',
			'Can someone swap with me? I have a conflict.',
			'Notes submitted.'
		],
		labels: ['work']
	},
	{
		subject: 'Recipe you asked for',
		opener: ['{to},', 'Here is the {dish} recipe. The secret is to let the base cook down slowly.'],
		replies: [
			'Made it last night. Amazing!',
			'How long do you marinate it?',
			'Adding this to the family cookbook.'
		],
		labels: ['family']
	},
	{
		subject: 'Can you present at the {topic} meetup?',
		opener: [
			'Hi {to},',
			'We are running a small meetup on {topic} next month. Would you give a 20-minute talk?'
		],
		replies: [
			'I would love to. Can I pick the angle?',
			'Sure, send me the details.',
			'Slides are ready, sharing them now.'
		],
		labels: ['work']
	},
	{
		subject: 'Moving day',
		opener: [
			'Hey {to},',
			'We move on {day}. Any chance you could help with the boxes in the morning?'
		],
		replies: [
			'Count me in. I will bring snacks.',
			'I can come after {time}.',
			'Glad it all went well!'
		]
	}
];

/** A one-off message from a brand or service. */
export interface BulletinDef {
	category: Category | 'spam';
	brand: string;
	address: string;
	subject: string;
	body: string[];
	cta?: string;
	labels?: string[];
	attachment?: string;
}

export const BULLETINS: readonly BulletinDef[] = [
	{
		category: 'promotions',
		brand: 'Lumen Store',
		address: 'deals@lumen.example',
		subject: '30% off {product} this week only',
		body: ['Our best {product} is on sale until {day}.', 'Free delivery on orders over $50.'],
		cta: 'Shop the sale'
	},
	{
		category: 'promotions',
		brand: 'Lumen Store',
		address: 'deals@lumen.example',
		subject: 'Your cart misses you',
		body: ['You left a {product} in your cart. It is still available in your size.'],
		cta: 'Back to cart'
	},
	{
		category: 'promotions',
		brand: 'Kettle & Co',
		address: 'hello@kettle.example',
		subject: 'New: single-origin beans from {place}',
		body: ['Bright, fruity and roasted this week.', 'Members get early access.'],
		cta: 'Try a bag'
	},
	{
		category: 'promotions',
		brand: 'Stride',
		address: 'news@stride.example',
		subject: 'Weekend flash sale',
		body: ['Up to 40% off {product} and more. Ends {day} at midnight.'],
		cta: 'See deals'
	},
	{
		category: 'promotions',
		brand: 'Wander',
		address: 'offers@wander.example',
		subject: 'Fares to {place} from $129',
		body: ['Fly to {place} this season. Limited seats at this price.'],
		cta: 'Find flights',
		labels: ['travel']
	},
	{
		category: 'social',
		brand: 'Circle',
		address: 'notify@circle.example',
		subject: '{from} mentioned you in a comment',
		body: ['{from} mentioned you: "This is exactly what we talked about!"'],
		cta: 'View comment'
	},
	{
		category: 'social',
		brand: 'Circle',
		address: 'notify@circle.example',
		subject: 'You have 3 new connection requests',
		body: ['{from} and 2 others want to connect with you.'],
		cta: 'Review requests'
	},
	{
		category: 'social',
		brand: 'Snapline',
		address: 'no-reply@snapline.example',
		subject: '{from} shared a photo album',
		body: ['{from} shared "Weekend in {place}" with you.'],
		cta: 'Open album'
	},
	{
		category: 'social',
		brand: 'Circle',
		address: 'notify@circle.example',
		subject: 'Your weekly activity summary',
		body: ['Your posts were seen 1,204 times this week.'],
		cta: 'See insights'
	},
	{
		category: 'updates',
		brand: 'Parcelly',
		address: 'tracking@parcelly.example',
		subject: 'Your order has shipped',
		body: [
			'Your {product} is on its way.',
			'Tracking number: {tracking}',
			'Expected delivery: {day}.'
		],
		cta: 'Track package',
		labels: ['receipts']
	},
	{
		category: 'updates',
		brand: 'Northbank',
		address: 'alerts@northbank.example',
		subject: 'Your verification code',
		body: [
			'Your Northbank code is {code}. It expires in 10 minutes.',
			'Never share this code with anyone.'
		]
	},
	{
		category: 'updates',
		brand: 'Lumen Store',
		address: 'orders@lumen.example',
		subject: 'Receipt for order #{number}',
		body: ['Thanks for your order. You paid ${amount}.', 'Your invoice is attached.'],
		labels: ['receipts'],
		attachment: 'invoice'
	},
	{
		category: 'updates',
		brand: 'Calendar',
		address: 'invites@calendar.example',
		subject: 'Invitation: {project} sync on {day} at {time}',
		body: ['You have been invited to "{project} sync".', 'When: {day} at {time} (30 minutes).'],
		cta: 'RSVP',
		labels: ['work']
	},
	{
		category: 'updates',
		brand: 'Wander',
		address: 'trips@wander.example',
		subject: 'Your trip to {place} is confirmed',
		body: ['Booking reference {code}.', 'Check-in opens 24 hours before departure.'],
		labels: ['travel'],
		attachment: 'ticket'
	},
	{
		category: 'updates',
		brand: 'CloudBox',
		address: 'billing@cloudbox.example',
		subject: 'Your storage plan renews on {day}',
		body: ['Your plan renews automatically. No action is needed.']
	},
	{
		category: 'forums',
		brand: 'Svelte Circle',
		address: 'digest@forum.example',
		subject: 'Digest: {topic} and 4 more threads',
		body: [
			'Top thread: "How do you handle {topic}?" (32 replies).',
			'Also trending: release notes and community showcase.'
		],
		cta: 'Read the digest'
	},
	{
		category: 'forums',
		brand: 'Design Guild',
		address: 'list@guild.example',
		subject: '[guild] Feedback wanted on {project}',
		body: ['{from} posted: I would love critique on our {project} mockups.'],
		cta: 'Join the thread'
	},
	{
		category: 'forums',
		brand: 'Runners Club',
		address: 'list@runners.example',
		subject: '[runners] {day} long run route',
		body: ['Meet at the park gate at {time}. 14 km, easy pace.']
	},
	{
		category: 'spam',
		brand: 'Prize Center',
		address: 'winner@prize-center.example',
		subject: 'CONGRATULATIONS! You have won a {product}',
		body: [
			'You were selected as our lucky winner! Claim your prize now before it expires.',
			'Act fast: offer ends in 24 hours.'
		],
		cta: 'Claim now'
	},
	{
		category: 'spam',
		brand: 'Account Security',
		address: 'security@n0rthbank-verify.example',
		subject: 'Urgent: your account will be suspended',
		body: [
			'We detected unusual activity. Verify your password immediately or your account will be closed.'
		],
		cta: 'Verify account'
	},
	{
		category: 'spam',
		brand: 'Crypto Boost',
		address: 'gains@cryptoboost.example',
		subject: 'Turn $100 into $10,000 this week',
		body: ['Guaranteed returns with zero risk. Limited spots left!'],
		cta: 'Start earning'
	},
	{
		category: 'spam',
		brand: 'Parcel Service',
		address: 'delivery@parcel-redelivery.example',
		subject: 'Delivery failed: pay $1.99 to reschedule',
		body: ['Your package could not be delivered. Pay the small fee to reschedule.'],
		cta: 'Pay now'
	}
];
