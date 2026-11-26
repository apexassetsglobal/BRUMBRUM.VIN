ALTER TABLE users ADD COLUMN avatar_key TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN panorama_key TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN show_profile_images INTEGER NOT NULL DEFAULT 0;
