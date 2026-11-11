-- Turso Cloud / libSQL. Execute with foreign keys enabled on every connection.
PRAGMA foreign_keys = ON;

CREATE TABLE products (
  product_id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  reference TEXT,
  slug TEXT,
  source_url TEXT,
  description_html TEXT,
  description_text TEXT,
  specifications_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(specifications_json)),
  embedding F32_BLOB(384),
  embedding_model TEXT,
  embedding_version TEXT,
  extracted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX products_brand_idx ON products (brand);
CREATE INDEX products_embedding_idx ON products (libsql_vector_idx(embedding)) WHERE embedding IS NOT NULL;

CREATE TABLE categories (
  category_id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT
);
CREATE TABLE product_categories (
  product_id TEXT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(category_id),
  PRIMARY KEY (product_id, category_id)
);
CREATE INDEX product_categories_category_idx ON product_categories (category_id);

CREATE TABLE skus (
  sku_id TEXT NOT NULL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  name TEXT,
  reference TEXT,
  ean TEXT,
  images_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(images_json)),
  seller_id TEXT,
  seller_name TEXT,
  price REAL CHECK (price IS NULL OR price >= 0),
  list_price REAL CHECK (list_price IS NULL OR list_price >= 0),
  stock INTEGER CHECK (stock IS NULL OR stock >= 0)
);
CREATE INDEX skus_product_idx ON skus (product_id);
CREATE INDEX skus_price_idx ON skus (price);

CREATE TABLE service_documents (
  document_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  content TEXT NOT NULL,
  source_checked_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  embedding F32_BLOB(384),
  embedding_model TEXT,
  embedding_version TEXT
);

-- This singleton records the last fully successful catalog import, not a scrape start.
CREATE TABLE catalog_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_successful_import_at TEXT NOT NULL,
  extracted_at TEXT NOT NULL
);
