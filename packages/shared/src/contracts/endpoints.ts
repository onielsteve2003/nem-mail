import { z } from 'zod';
import { AIInsightsSchema, ExtractionSchema } from '../schemas/ai';
import { EmailSchema, IdSchema, IsoDateTimeSchema } from '../schemas/common';
import { DraftSchema } from '../schemas/draft';
import { LabelSchema } from '../schemas/label';
import { AttachmentSchema, ThreadSchema, ThreadSummarySchema } from '../schemas/mail';
import { CategorySchema, SystemMailboxSchema } from '../schemas/mailbox';
import { SettingsSchema } from '../schemas/settings';
import { ContactSchema, UserSchema } from '../schemas/user';
import { pageSchema, PageQuerySchema } from './pagination';
import { BulkThreadRequestSchema, BulkThreadResponseSchema } from './threads';

export const API_BASE_PATH = '/api/v1';
export const PASSWORD_MIN = 8;

/** Query strings carry booleans as text. */
const queryBoolean = z.preprocess(
	(value) => (value === 'true' ? true : value === 'false' ? false : value),
	z.boolean()
);

// Auth
export const SignUpRequestSchema = z.object({
	name: UserSchema.shape.name,
	email: EmailSchema,
	password: z.string().min(PASSWORD_MIN).max(200)
});
export type SignUpRequest = z.infer<typeof SignUpRequestSchema>;
export const SignInRequestSchema = SignUpRequestSchema.pick({ email: true, password: true });
export type SignInRequest = z.infer<typeof SignInRequestSchema>;
export const SessionResponseSchema = z.object({
	token: z.string().min(1),
	expiresAt: IsoDateTimeSchema,
	user: UserSchema
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

// Threads
export const ThreadListQuerySchema = PageQuerySchema.extend({
	mailbox: SystemMailboxSchema.optional(),
	category: CategorySchema.optional(),
	label: IdSchema.optional()
}).refine((query) => (query.mailbox === undefined) !== (query.label === undefined), {
	message: 'Pass either mailbox or label'
});
export type ThreadListQuery = z.input<typeof ThreadListQuerySchema>;
export const ThreadPageSchema = pageSchema(ThreadSummarySchema);

// Labels
export const CreateLabelRequestSchema = LabelSchema.omit({ id: true });
export type CreateLabelRequest = z.infer<typeof CreateLabelRequestSchema>;
export const UpdateLabelRequestSchema = CreateLabelRequestSchema.partial();
export type UpdateLabelRequest = z.infer<typeof UpdateLabelRequestSchema>;

// Send
export const SendRequestSchema = z.object({
	draft: DraftSchema,
	/** Absent: send after the undo window. Set: schedule for that time (FR-5.6). */
	sendAt: IsoDateTimeSchema.optional()
});
export type SendRequest = z.infer<typeof SendRequestSchema>;
export const SendResponseSchema = z.object({
	messageId: IdSchema,
	threadId: IdSchema,
	/** When it leaves the outbox; the send can be cancelled until then. */
	sendAt: IsoDateTimeSchema
});
export type SendResponse = z.infer<typeof SendResponseSchema>;

// Search
export const SearchQuerySchema = PageQuerySchema.extend({
	q: z.string().trim().min(1).max(500),
	semantic: queryBoolean.default(false)
});
export type SearchQuery = z.input<typeof SearchQuerySchema>;

// Contacts
export const ContactQuerySchema = z.object({
	q: z.string().trim().max(200).default(''),
	limit: z.coerce.number().int().min(1).max(20).default(8)
});
export type ContactQuery = z.input<typeof ContactQuerySchema>;

// Counts
const countSchema = z.int().nonnegative();
export const CountsResponseSchema = z.object({
	/** Unread threads per mailbox; drafts, outbox and scheduled count every item. */
	mailboxes: z.partialRecord(SystemMailboxSchema, countSchema),
	categories: z.partialRecord(CategorySchema, countSchema),
	labels: z.record(IdSchema, countSchema)
});
export type CountsResponse = z.infer<typeof CountsResponseSchema>;

// AI
export const ThreadRefRequestSchema = z.object({ threadId: IdSchema });
export type ThreadRefRequest = z.infer<typeof ThreadRefRequestSchema>;
export const SummaryResponseSchema = AIInsightsSchema.shape.summary.unwrap();
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;
export const RepliesResponseSchema = AIInsightsSchema.shape.smartReplies.unwrap();
export type RepliesResponse = z.infer<typeof RepliesResponseSchema>;
export const AssistantRequestSchema = z.object({
	prompt: z.string().trim().min(1).max(2000),
	threadId: IdSchema.optional()
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;
export const AssistantResponseSchema = z.object({
	text: z.string(),
	/** Threads the answer drew on, so the UI can link to them. */
	threadIds: z.array(IdSchema),
	extractions: z.array(ExtractionSchema)
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

export const FEEDBACK_TYPES = ['open', 'reply', 'spam', 'notSpam', 'moveCategory'] as const;
export const FeedbackRequestSchema = z.object({
	type: z.enum(FEEDBACK_TYPES),
	threadId: IdSchema,
	/** The category the user moved the thread to, for `moveCategory`. */
	category: CategorySchema.optional()
});
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

// Realtime (SSE on /events/stream)
export const ServerEventSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('mail.new'), summary: ThreadSummarySchema }),
	z.object({ type: z.literal('counts'), counts: CountsResponseSchema })
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;

const EmptySchema = z.object({});
const OkSchema = z.object({ ok: z.literal(true) });

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface EndpointDef {
	method: HttpMethod;
	path: `/${string}`;
	query?: z.ZodType;
	body?: z.ZodType;
	response: z.ZodType;
}

/**
 * The endpoint map (architecture section 7). Paths are relative to API_BASE_PATH and
 * `:id` is a path parameter. Client and server validate against the same schemas.
 * Attachment upload is multipart and the SSE stream is not JSON, so neither has a body schema.
 */
export const ENDPOINTS = {
	signUp: {
		method: 'POST',
		path: '/auth/signup',
		body: SignUpRequestSchema,
		response: SessionResponseSchema
	},
	signIn: {
		method: 'POST',
		path: '/auth/signin',
		body: SignInRequestSchema,
		response: SessionResponseSchema
	},
	signOut: { method: 'POST', path: '/auth/signout', body: EmptySchema, response: OkSchema },
	me: { method: 'GET', path: '/me', response: UserSchema },
	listThreads: {
		method: 'GET',
		path: '/threads',
		query: ThreadListQuerySchema,
		response: ThreadPageSchema
	},
	getThread: { method: 'GET', path: '/threads/:id', response: ThreadSchema },
	bulkThreads: {
		method: 'PATCH',
		path: '/threads',
		body: BulkThreadRequestSchema,
		response: BulkThreadResponseSchema
	},
	listLabels: { method: 'GET', path: '/labels', response: z.array(LabelSchema) },
	createLabel: {
		method: 'POST',
		path: '/labels',
		body: CreateLabelRequestSchema,
		response: LabelSchema
	},
	updateLabel: {
		method: 'PATCH',
		path: '/labels/:id',
		body: UpdateLabelRequestSchema,
		response: LabelSchema
	},
	deleteLabel: { method: 'DELETE', path: '/labels/:id', response: OkSchema },
	listDrafts: { method: 'GET', path: '/drafts', response: z.array(DraftSchema) },
	getDraft: { method: 'GET', path: '/drafts/:id', response: DraftSchema },
	saveDraft: { method: 'PUT', path: '/drafts/:id', body: DraftSchema, response: DraftSchema },
	deleteDraft: { method: 'DELETE', path: '/drafts/:id', response: OkSchema },
	send: { method: 'POST', path: '/send', body: SendRequestSchema, response: SendResponseSchema },
	/** Undo or cancel a pending send; the message comes back as a draft. */
	cancelSend: { method: 'DELETE', path: '/send/:id', response: DraftSchema },
	search: {
		method: 'GET',
		path: '/search',
		query: SearchQuerySchema,
		response: ThreadPageSchema
	},
	uploadAttachment: { method: 'POST', path: '/attachments', response: AttachmentSchema },
	getAttachment: { method: 'GET', path: '/attachments/:id', response: z.instanceof(Blob) },
	listContacts: {
		method: 'GET',
		path: '/contacts',
		query: ContactQuerySchema,
		response: z.array(ContactSchema)
	},
	getSettings: { method: 'GET', path: '/settings', response: SettingsSchema },
	putSettings: { method: 'PUT', path: '/settings', body: SettingsSchema, response: SettingsSchema },
	counts: { method: 'GET', path: '/counts', response: CountsResponseSchema },
	aiSummary: {
		method: 'POST',
		path: '/ai/summary',
		body: ThreadRefRequestSchema,
		response: SummaryResponseSchema
	},
	aiReplies: {
		method: 'POST',
		path: '/ai/replies',
		body: ThreadRefRequestSchema,
		response: RepliesResponseSchema
	},
	aiAssistant: {
		method: 'POST',
		path: '/ai/assistant',
		body: AssistantRequestSchema,
		response: AssistantResponseSchema
	},
	aiFeedback: {
		method: 'POST',
		path: '/ai/feedback',
		body: FeedbackRequestSchema,
		response: OkSchema
	},
	events: { method: 'GET', path: '/events/stream', response: ServerEventSchema }
} as const satisfies Record<string, EndpointDef>;
export type EndpointName = keyof typeof ENDPOINTS;

/** Fills `:param` segments, encoding each value. Throws when one is missing. */
export function buildPath(path: string, params: Record<string, string> = {}): string {
	return path.replace(/:(\w+)/g, (_match, name: string) => {
		const value = params[name];
		if (value === undefined) throw new Error(`Missing path param "${name}" for ${path}`);
		return encodeURIComponent(value);
	});
}
