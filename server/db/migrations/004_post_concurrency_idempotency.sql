-- Optimistic concurrency for post edits.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Idempotency keys prevent duplicate rows when clients retry after a lost response.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS client_request_id UUID;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS client_request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS posts_client_request_id_key
  ON posts (client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS comments_client_request_id_key
  ON comments (client_request_id)
  WHERE client_request_id IS NOT NULL;
