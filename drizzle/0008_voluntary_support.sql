CREATE TABLE support_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT REFERENCES listings(id),
  package_id TEXT NOT NULL CHECK(package_id IN ('pit-stop','v8-club','supercar-elite','hypercar-sovereign')),
  amount INTEGER NOT NULL CHECK(amount IN (1000,10000,100000,1000000)),
  currency TEXT NOT NULL DEFAULT 'pln' CHECK(currency='pln'),
  payment_link TEXT NOT NULL,
  livemode INTEGER NOT NULL CHECK(livemode IN (0,1)),
  client_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id,client_key)
);
--> statement-breakpoint
CREATE TABLE support_payments (
  session_id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES support_attempts(id),
  status TEXT NOT NULL CHECK(status IN ('pending','paid','failed','expired')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK(currency='pln'),
  paid_at TEXT,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE support_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES support_payments(session_id),
  type TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX support_attempts_user ON support_attempts(user_id,created_at);
--> statement-breakpoint
CREATE INDEX support_payments_attempt ON support_payments(attempt_id);
