-- Apply after 001_initial.sql, before running the loader.
ALTER TABLE products ADD COLUMN embedding_hash TEXT;
