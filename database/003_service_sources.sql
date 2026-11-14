-- Apply manually after 001 and 002. Existing service_documents and all product data remain untouched.
CREATE TABLE service_sources (
  source_id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  source_checked_at TEXT NOT NULL,
  version_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE service_chunks (
  source_id TEXT NOT NULL REFERENCES service_sources(source_id) ON DELETE CASCADE,
  chunk_order INTEGER NOT NULL CHECK (chunk_order >= 0),
  heading TEXT NOT NULL,
  applicability TEXT NOT NULL CHECK (applicability IN ('propio', 'marketplace', 'ambos', 'indeterminado')),
  content TEXT NOT NULL,
  version_hash TEXT NOT NULL,
  embedding F32_BLOB(384) NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_version TEXT NOT NULL,
  PRIMARY KEY (source_id, chunk_order)
);
CREATE INDEX service_chunks_embedding_idx ON service_chunks (libsql_vector_idx(embedding));
