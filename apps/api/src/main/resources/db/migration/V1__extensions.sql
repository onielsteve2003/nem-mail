-- Extensions the schema relies on: pgvector for embeddings (Neon and the
-- compose image both ship it).
create extension if not exists vector;
