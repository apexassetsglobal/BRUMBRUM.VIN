ALTER TABLE listings ADD COLUMN spin_ids TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE listings ADD COLUMN video_id TEXT;
--> statement-breakpoint
ALTER TABLE listing_edits ADD COLUMN spin_ids TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE listing_edits ADD COLUMN video_id TEXT;
--> statement-breakpoint
CREATE TABLE listing_videos (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL CHECK(size > 0),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX listing_videos_owner ON listing_videos(listing_id);
