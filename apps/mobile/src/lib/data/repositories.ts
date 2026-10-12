import type {
	Account,
	AssistantRequest,
	AssistantResponse,
	Attachment,
	BinMailbox,
	BulkThreadResponse,
	Contact,
	ContactQuery,
	CountsResponse,
	CreateLabelRequest,
	Draft,
	FeedbackRequest,
	Label,
	Page,
	PageQuery,
	RepliesResponse,
	SearchQuery,
	SendRequest,
	SendResponse,
	ServerEvent,
	SessionResponse,
	Settings,
	SignInRequest,
	SignUpRequest,
	SummaryResponse,
	Thread,
	ThreadListFilter,
	ThreadOp,
	ThreadSummary,
	UpdateLabelRequest,
	User
} from '@nem/shared';

/*
 * The only contracts the UI and stores depend on. Mock and HTTP implementations
 * return domain types from @nem/shared and throw AppError (with an ApiErrorCode) on failure.
 */

export interface AuthRepository {
	signUp(request: SignUpRequest): Promise<SessionResponse>;
	signIn(request: SignInRequest): Promise<SessionResponse>;
	/** Signs out the current account; other accounts on the device stay signed in. */
	signOut(): Promise<void>;
	/** The current user, or null when nobody is signed in. */
	me(): Promise<User | null>;
	/** Accounts signed in on this device, for the account switcher (FR-1.4). */
	listAccounts(): Promise<Account[]>;
	switchAccount(accountId: string): Promise<User>;
}

export interface MailRepository {
	list(filter: ThreadListFilter, page?: PageQuery): Promise<Page<ThreadSummary>>;
	get(threadId: string): Promise<Thread>;
	/** Applies one op to many threads. Unknown ids are skipped, not an error. */
	apply(threadIds: string[], op: ThreadOp): Promise<BulkThreadResponse>;
	/** Deletes threads forever. Only threads in Spam or Trash go; others are skipped. */
	deleteForever(threadIds: string[]): Promise<BulkThreadResponse>;
	/** Deletes every thread in Spam or Trash forever. */
	empty(mailbox: BinMailbox): Promise<BulkThreadResponse>;
	counts(): Promise<CountsResponse>;
	getAttachment(attachmentId: string): Promise<Blob>;
	/** New mail and count changes. Returns an unsubscribe function. */
	subscribe(listener: (event: ServerEvent) => void): () => void;
}

export interface LabelRepository {
	list(): Promise<Label[]>;
	create(request: CreateLabelRequest): Promise<Label>;
	update(labelId: string, request: UpdateLabelRequest): Promise<Label>;
	/** Removes the label from every thread too; child labels move to the top level. */
	remove(labelId: string): Promise<void>;
}

export interface DraftRepository {
	list(): Promise<Draft[]>;
	get(draftId: string): Promise<Draft>;
	/** Creates or replaces the draft with this id (autosave). */
	save(draft: Draft): Promise<Draft>;
	remove(draftId: string): Promise<void>;
	uploadAttachment(file: File): Promise<Attachment>;
	/** Queues the draft in the outbox, or schedules it when `sendAt` is set. */
	send(request: SendRequest): Promise<SendResponse>;
	/** Undo send or cancel a scheduled message; it comes back as a draft. */
	cancelSend(messageId: string): Promise<Draft>;
}

export interface ContactRepository {
	/** Autocomplete matches, best first (frequency, then recency). */
	search(query: ContactQuery): Promise<Contact[]>;
}

export interface SettingsRepository {
	get(): Promise<Settings>;
	save(settings: Settings): Promise<Settings>;
}

export interface SearchRepository {
	search(query: SearchQuery): Promise<Page<ThreadSummary>>;
}

/** Server-side AI (Phase 2). In Phase 1 the on-device AIService (T10.1) does this work. */
export interface AIRepository {
	summary(threadId: string): Promise<SummaryResponse>;
	replies(threadId: string): Promise<RepliesResponse>;
	assistant(request: AssistantRequest): Promise<AssistantResponse>;
	/** Records a learning signal (open, reply, spam, category move). */
	feedback(request: FeedbackRequest): Promise<void>;
}

export interface Repositories {
	auth: AuthRepository;
	mail: MailRepository;
	labels: LabelRepository;
	drafts: DraftRepository;
	contacts: ContactRepository;
	settings: SettingsRepository;
	search: SearchRepository;
	ai: AIRepository;
}
