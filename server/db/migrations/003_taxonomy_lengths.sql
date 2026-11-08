-- Align taxonomy columns with the 100-character API validation limit.
-- Older databases were created with shorter VARCHAR limits.

ALTER TABLE categories ALTER COLUMN name TYPE VARCHAR(100);
ALTER TABLE categories ALTER COLUMN slug TYPE VARCHAR(100);

ALTER TABLE tags ALTER COLUMN name TYPE VARCHAR(100);
ALTER TABLE tags ALTER COLUMN slug TYPE VARCHAR(100);
