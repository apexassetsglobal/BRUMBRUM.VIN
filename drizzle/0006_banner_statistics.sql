CREATE TABLE site_banner_stats (
  day TEXT NOT NULL,
  banner_id TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  PRIMARY KEY (day, banner_id)
);
