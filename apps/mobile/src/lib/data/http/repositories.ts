import type {
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
	Settings,
	SummaryResponse,
	Thread,
	ThreadListFilter,
	ThreadOp,
	ThreadSummary,
	UpdateLabelRequest
} from '@nem/shared';
import type {
	AIRepository,
	ContactRepository,
	DraftRepository,
	LabelRepository,
	MailRepository,
	SearchRepository,
	SettingsRepository
} from '../repositories.js';
import type { HttpClient } from './client.js';

const NONE: BulkThreadResponse = { updatedIds: [] };

/** Threads over the API. The realtime stream (T19.4) feeds `subscribe`. */
export class HttpMailRepository implements MailRepository {
	readonly #http: HttpClient;
	readonly #listeners = new Set<(event: ServerEvent) => void>();

	constructor(http: HttpClient) {
		this.#http = http;
	}

	list(filter: ThreadListFilter, page: PageQuery = {}): Promise<Page<ThreadSummary>> {
		const query =
			'labelId' in filter
				? { label: filter.labelId, ...page }
				: { mailbox: filter.mailbox, category: filter.category, ...page };
		return this.#http.call('listThreads', { query });
	}

	get(threadId: string): Promise<Thread> {
		return this.#http.call('getThread', { params: { id: threadId } });
	}

	// The API rejects an empty id list; the mock treats it as nothing to do, and so do we.
	async apply(threadIds: string[], op: ThreadOp): Promise<BulkThreadResponse> {
		if (threadIds.length === 0) return NONE;
		return this.#http.call('bulkThreads', { body: { ids: threadIds, op } });
	}

	async deleteForever(threadIds: string[]): Promise<BulkThreadResponse> {
		if (threadIds.length === 0) return NONE;
		return this.#http.call('deleteThreads', { body: { ids: threadIds } });
	}

	empty(mailbox: BinMailbox): Promise<BulkThreadResponse> {
		return this.#http.call('emptyMailbox', { params: { mailbox } });
	}

	counts(): Promise<CountsResponse> {
		return this.#http.call('counts');
	}

	getAttachment(attachmentId: string): Promise<Blob> {
		return this.#http.blob('getAttachment', { params: { id: attachmentId } });
	}

	subscribe(listener: (event: ServerEvent) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Hands a server event to every subscriber. */
	emit(event: ServerEvent): void {
		for (const listener of this.#listeners) listener(event);
	}
}

export class HttpLabelRepository implements LabelRepository {
	readonly #http: HttpClient;

	constructor(http: HttpClient) {
		this.#http = http;
	}

	list(): Promise<Label[]> {
		return this.#http.call('listLabels');
	}

	create(request: CreateLabelRequest): Promise<Label> {
		return this.#http.call('createLabel', { body: request });
	}

	update(labelId: string, request: UpdateLabelRequest): Promise<Label> {
		return this.#http.call('updateLabel', { params: { id: labelId }, body: request });
	}

	async remove(labelId: string): Promise<void> {
		await this.#http.call('deleteLabel', { params: { id: labelId } });
	}
}

export class HttpDraftRepository implements DraftRepository {
	readonly #http: HttpClient;

	constructor(http: HttpClient) {
		this.#http = http;
	}

	list(): Promise<Draft[]> {
		return this.#http.call('listDrafts');
	}

	get(draftId: string): Promise<Draft> {
		return this.#http.call('getDraft', { params: { id: draftId } });
	}

	save(draft: Draft): Promise<Draft> {
		return this.#http.call('saveDraft', { params: { id: draft.id }, body: draft });
	}

	async remove(draftId: string): Promise<void> {
		await this.#http.call('deleteDraft', { params: { id: draftId } });
	}

	/** Multipart upload in the `file` part. @throws AppError PAYLOAD_TOO_LARGE over 10 MB. */
	uploadAttachment(file: File): Promise<Attachment> {
		const form = new FormData();
		form.append('file', file, file.name || 'attachment');
		return this.#http.call('uploadAttachment', { body: form });
	}

	send(request: SendRequest): Promise<SendResponse> {
		return this.#http.call('send', { body: request });
	}

	cancelSend(messageId: string): Promise<Draft> {
		return this.#http.call('cancelSend', { params: { id: messageId } });
	}
}

export class HttpContactRepository implements ContactRepository {
	readonly #http: HttpClient;

	constructor(http: HttpClient) {
		this.#http = http;
	}

	search(query: ContactQuery): Promise<Contact[]> {
		return this.#http.call('listContacts', { query });
	}
}

export class HttpSettingsRepository implements SettingsRepository {
	readonly #http: HttpClient;

	constructor(http: HttpClient) {
		this.#http = http;
	}

	get(): Promise<Settings> {
		return this.#http.call('getSettings');
	}

	save(settings: Settings): Promise<Settings> {
		return this.#http.call('putSettings', { body: settings });
	}
}

export class HttpSearchRepository implements SearchRepository {
	readonly #http: HttpClient;

	constructor(http: HttpClient) {
		this.#http = http;
	}

	search(query: SearchQuery): Promise<Page<ThreadSummary>> {
		return this.#http.call('search', { query });
	}
}

export class HttpAIRepository implements AIRepository {
	readonly #http: HttpClient;

	constructor(http: HttpClient) {
		this.#http = http;
	}

	summary(threadId: string): Promise<SummaryResponse> {
		return this.#http.call('aiSummary', { body: { threadId } });
	}

	replies(threadId: string): Promise<RepliesResponse> {
		return this.#http.call('aiReplies', { body: { threadId } });
	}

	assistant(request: AssistantRequest): Promise<AssistantResponse> {
		return this.#http.call('aiAssistant', { body: request });
	}

	async feedback(request: FeedbackRequest): Promise<void> {
		await this.#http.call('aiFeedback', { body: request });
	}
}
