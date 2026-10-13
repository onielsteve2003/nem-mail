-- Core schema (architecture-context section 6). Enum-like columns are text with
-- check constraints whose values match the Zod enums in @nem/shared.

create table users (
  id uuid primary key,
  email text not null,
  name text not null,
  password_hash text not null,
  avatar_seed text not null,
  created_at timestamptz not null default now()
);
create unique index users_email_key on users (lower(email));

create table sessions (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  -- SHA-256 of the bearer token; the token itself is never stored.
  token_hash bytea not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index sessions_token_hash_key on sessions (token_hash);
create index sessions_user_id_idx on sessions (user_id);

create table contacts (
  id uuid primary key,
  owner_id uuid not null references users (id) on delete cascade,
  email text not null,
  name text,
  last_contacted_at timestamptz,
  frequency integer not null default 0 check (frequency >= 0)
);
create unique index contacts_owner_email_key on contacts (owner_id, lower(email));

create table threads (
  id uuid primary key,
  subject text not null,
  last_message_at timestamptz not null,
  message_count integer not null default 0 check (message_count >= 0)
);

create table messages (
  id uuid primary key,
  thread_id uuid not null references threads (id) on delete cascade,
  -- Null for mail from outside the app.
  from_user_id uuid references users (id) on delete set null,
  from_email text not null,
  from_name text,
  subject text not null,
  body_html text,
  body_text text not null,
  snippet text not null,
  sent_at timestamptz not null,
  -- When an undo-send or scheduled message goes out; null once sent.
  send_at timestamptz,
  status text not null check (status in ('draft', 'scheduled', 'outbox', 'sent')),
  in_reply_to uuid references messages (id) on delete set null,
  ai jsonb,
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(subject, '')), 'A')
      || setweight(to_tsvector('english', coalesce(from_name, '') || ' ' || from_email), 'B')
      || setweight(to_tsvector('english', body_text), 'C')
  ) stored
);
create index messages_thread_sent_idx on messages (thread_id, sent_at);
create index messages_search_idx on messages using gin (search);
-- The sweeper looks for undo-send and scheduled mail that is due.
create index messages_send_at_idx on messages (send_at) where send_at is not null;

create table message_recipients (
  id uuid primary key,
  message_id uuid not null references messages (id) on delete cascade,
  email text not null,
  name text,
  -- Set when the address belongs to a user of the app.
  user_id uuid references users (id) on delete set null,
  kind text not null check (kind in ('to', 'cc', 'bcc'))
);
create index message_recipients_message_idx on message_recipients (message_id);

-- One row per user per message: that user's copy, flags and folder.
create table mailbox_entries (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  message_id uuid not null references messages (id) on delete cascade,
  thread_id uuid not null references threads (id) on delete cascade,
  -- Null when archived: the message is then only in All mail.
  mailbox text check (mailbox in ('inbox', 'sent', 'scheduled', 'outbox', 'drafts', 'spam', 'trash')),
  category text check (category in ('primary', 'promotions', 'social', 'updates', 'forums')),
  -- Copied from threads, so the list query sorts on this index alone.
  last_message_at timestamptz not null,
  is_read boolean not null default false,
  is_starred boolean not null default false,
  is_important boolean not null default false,
  is_muted boolean not null default false,
  snoozed_until timestamptz,
  deleted_at timestamptz,
  unique (user_id, message_id)
);
create index mailbox_entries_list_idx
  on mailbox_entries (user_id, mailbox, category, last_message_at desc);
create index mailbox_entries_thread_idx on mailbox_entries (user_id, thread_id);
create index mailbox_entries_snoozed_idx
  on mailbox_entries (snoozed_until) where snoozed_until is not null;

create table labels (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  color text not null check (color in ('neutral', 'violet', 'lime', 'cyan', 'coral', 'amber')),
  parent_id uuid references labels (id) on delete cascade,
  unique nulls not distinct (user_id, parent_id, name)
);

create table entry_labels (
  entry_id uuid not null references mailbox_entries (id) on delete cascade,
  label_id uuid not null references labels (id) on delete cascade,
  primary key (entry_id, label_id)
);
create index entry_labels_label_idx on entry_labels (label_id);

create table attachments (
  id uuid primary key,
  message_id uuid references messages (id) on delete cascade,
  filename text not null,
  mime text not null,
  size integer not null check (size >= 0 and size <= 10485760),
  data bytea
);
create index attachments_message_idx on attachments (message_id);

create table drafts (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  thread_id uuid references threads (id) on delete set null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create index drafts_user_updated_idx on drafts (user_id, updated_at desc);

create table settings (
  user_id uuid primary key references users (id) on delete cascade,
  data jsonb not null
);

create table ml_models (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('spam', 'priority', 'category', 'ngram')),
  params jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

-- all-MiniLM-L6-v2 sentence embeddings, normalized, so cosine = inner product.
create table embeddings (
  message_id uuid primary key references messages (id) on delete cascade,
  vector vector(384) not null
);
create index embeddings_vector_idx on embeddings using hnsw (vector vector_cosine_ops);

create table events (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('open', 'reply', 'spam', 'move_category')),
  payload jsonb,
  created_at timestamptz not null default now()
);
create index events_user_created_idx on events (user_id, created_at desc);
