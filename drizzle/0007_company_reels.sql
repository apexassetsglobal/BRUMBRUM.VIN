CREATE TABLE company_reels (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  caption TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX company_reels_owner ON company_reels(user_id, created_at DESC);
