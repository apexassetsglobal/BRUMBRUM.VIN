CREATE TABLE site_page_views (
  day TEXT PRIMARY KEY NOT NULL,
  views INTEGER NOT NULL CHECK (views >= 0)
);
