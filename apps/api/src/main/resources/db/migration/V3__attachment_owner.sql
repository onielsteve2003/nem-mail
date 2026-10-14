-- Who uploaded the file. An upload belongs to no message until it is sent, so
-- this is how its owner can still read it. Null for seeded files.
alter table attachments add column user_id uuid references users (id) on delete cascade;
create index attachments_user_idx on attachments (user_id) where user_id is not null;
