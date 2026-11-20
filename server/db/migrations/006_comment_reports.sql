-- Visitor reports for comments. Comments stay public; admins review and delete.
CREATE TABLE IF NOT EXISTS comment_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  -- Hashed visitor identifier (user ID for members, hash for guests); no raw IP stored.
  reporter_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT comment_reports_comment_reporter_key UNIQUE (comment_id, reporter_key)
);

CREATE INDEX IF NOT EXISTS idx_comment_reports_comment_id ON comment_reports (comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_created_at ON comment_reports (created_at DESC);
