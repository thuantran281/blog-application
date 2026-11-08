-- Per-post byline. NULL means the post is displayed as Anonymous.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_display_name VARCHAR(100);

UPDATE posts p
SET author_display_name = u.username
FROM users u
WHERE p.author_id = u.id
  AND p.author_display_name IS NULL;
