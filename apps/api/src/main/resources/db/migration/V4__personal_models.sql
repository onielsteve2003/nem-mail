-- T18.3: lessons from "Not spam" and "Mark (not) important" are events too.
alter table events drop constraint events_type_check;
alter table events add constraint events_type_check check (
  type in ('open', 'reply', 'spam', 'not_spam', 'move_category', 'important', 'not_important')
);

-- A reader's own AI results for their copy (their models may disagree with the seed ones).
alter table mailbox_entries add column ai jsonb;
