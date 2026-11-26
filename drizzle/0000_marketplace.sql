CREATE TABLE users (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, email TEXT NOT NULL, password TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL, profile_type TEXT NOT NULL CHECK(profile_type IN ('private','company')),
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','moderator','admin')),
  verified_at TEXT, created_at TEXT NOT NULL, deleted_at TEXT,
  phone TEXT NOT NULL DEFAULT '', show_phone INTEGER NOT NULL DEFAULT 0, city TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '', lang TEXT NOT NULL DEFAULT 'pl', notify_messages INTEGER NOT NULL DEFAULT 1,
  notify_listings INTEGER NOT NULL DEFAULT 1, UNIQUE(scope,email)
);
--> statement-breakpoint
CREATE TABLE companies (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
  hours TEXT NOT NULL DEFAULT '', logo_key TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX sessions_user ON sessions(user_id);
--> statement-breakpoint
CREATE TABLE auth_tokens (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')), expires_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX auth_user ON auth_tokens(user_id,purpose);
--> statement-breakpoint
CREATE TABLE demo_workspaces (token TEXT PRIMARY KEY, scope TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE listings (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
  client_key TEXT NOT NULL, slug TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','published','rejected','held','sold','archived')),
  make TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', variant TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', fuel TEXT NOT NULL DEFAULT '',
  gearbox TEXT NOT NULL DEFAULT '', drive TEXT NOT NULL DEFAULT '', condition TEXT NOT NULL DEFAULT '',
  damage TEXT NOT NULL DEFAULT '', year INTEGER, mileage INTEGER, power INTEGER,
  price INTEGER, currency TEXT NOT NULL DEFAULT 'PLN', city TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}', photo_ids TEXT NOT NULL DEFAULT '[]', demo_photo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT, submitted_at TEXT, featured_until TEXT,
  rejection TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 0,
  UNIQUE(scope,slug), UNIQUE(user_id,client_key)
);
--> statement-breakpoint
CREATE INDEX listings_public ON listings(scope,status,published_at DESC);
--> statement-breakpoint
CREATE INDEX listings_search ON listings(scope,status,make,model);
--> statement-breakpoint
CREATE INDEX listings_owner ON listings(user_id,status);
--> statement-breakpoint
CREATE TABLE listing_edits (
  listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE, data TEXT NOT NULL,
  photo_ids TEXT NOT NULL, step INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE photos (
  id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  mime TEXT NOT NULL, thumb_mime TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
  digest TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(listing_id,digest)
);
--> statement-breakpoint
CREATE INDEX photos_owner ON photos(listing_id);
--> statement-breakpoint
CREATE TABLE favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, PRIMARY KEY(user_id,listing_id)
);
--> statement-breakpoint
CREATE TABLE conversations (
  id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id), buyer_id TEXT NOT NULL REFERENCES users(id),
  seller_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(listing_id,buyer_id), CHECK(buyer_id<>seller_id)
);
--> statement-breakpoint
CREATE INDEX conversations_buyer ON conversations(buyer_id,updated_at);
--> statement-breakpoint
CREATE INDEX conversations_seller ON conversations(seller_id,updated_at);
--> statement-breakpoint
CREATE TABLE messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id), client_key TEXT NOT NULL, body TEXT NOT NULL, proposed_at TEXT,
  proposal_status TEXT CHECK(proposal_status IN ('proposed','accepted','declined')),
  created_at TEXT NOT NULL, seen_at TEXT, UNIQUE(conversation_id,sender_id,client_key)
);
--> statement-breakpoint
CREATE INDEX messages_thread ON messages(conversation_id,created_at);
--> statement-breakpoint
CREATE TABLE blocks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, PRIMARY KEY(user_id,blocked_id)
);
--> statement-breakpoint
CREATE TABLE notifications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, read_at TEXT
);
--> statement-breakpoint
CREATE INDEX notifications_user ON notifications(user_id,read_at,created_at);
--> statement-breakpoint
CREATE TABLE reports (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, reporter_id TEXT REFERENCES users(id), listing_id TEXT REFERENCES listings(id),
  conversation_id TEXT REFERENCES conversations(id), kind TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL, created_at TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'open', resolution TEXT NOT NULL DEFAULT '',
  resolved_by TEXT REFERENCES users(id), resolved_at TEXT
);
--> statement-breakpoint
CREATE TABLE moderation (
  id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id), actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX moderation_listing ON moderation(listing_id,created_at);
--> statement-breakpoint
CREATE TABLE audit (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
  target TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE banners (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, title_pl TEXT NOT NULL, title_en TEXT NOT NULL,
  label_pl TEXT NOT NULL DEFAULT '', label_en TEXT NOT NULL DEFAULT '', link TEXT NOT NULL, image_key TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0, starts_at TEXT, ends_at TEXT, active INTEGER NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE contacts (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, user_id TEXT REFERENCES users(id), kind TEXT NOT NULL,
  name TEXT NOT NULL, email TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, handled_at TEXT
);
--> statement-breakpoint
CREATE TABLE import_runs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), source TEXT NOT NULL, filename TEXT NOT NULL,
  created_at TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'running', report TEXT NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0, valid INTEGER NOT NULL DEFAULT 0, client_key TEXT NOT NULL,
  UNIQUE(user_id,client_key)
);
--> statement-breakpoint
CREATE TABLE external_ids (
  user_id TEXT NOT NULL REFERENCES users(id), source TEXT NOT NULL, external_id TEXT NOT NULL,
  listing_id TEXT NOT NULL REFERENCES listings(id), PRIMARY KEY(user_id,source,external_id)
);
--> statement-breakpoint
CREATE TABLE settings (scope TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(scope,key));
--> statement-breakpoint
CREATE TABLE dictionary (
  scope TEXT NOT NULL, kind TEXT NOT NULL, parent TEXT NOT NULL DEFAULT '', value TEXT NOT NULL,
  label_pl TEXT NOT NULL DEFAULT '', label_en TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(scope,kind,parent,value)
);
--> statement-breakpoint
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
