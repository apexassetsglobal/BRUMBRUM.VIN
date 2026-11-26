CREATE TABLE robot_orders (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  buyer_id TEXT NOT NULL REFERENCES users(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  client_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('purchase','rental')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','accepted','rejected','cancelled','completed')),
  quantity INTEGER NOT NULL CHECK(quantity>=1 AND quantity<=100000),
  starts_on TEXT,
  ends_on TEXT,
  billing_unit TEXT NOT NULL CHECK(billing_unit IN ('item','day','week','month')),
  billing_periods INTEGER NOT NULL CHECK(billing_periods>=1),
  unit_amount INTEGER NOT NULL CHECK(unit_amount>0),
  unit_deposit_amount INTEGER NOT NULL DEFAULT 0 CHECK(unit_deposit_amount>=0),
  subtotal_amount INTEGER NOT NULL CHECK(subtotal_amount>0),
  deposit_amount INTEGER NOT NULL DEFAULT 0 CHECK(deposit_amount>=0),
  currency TEXT NOT NULL CHECK(currency IN ('PLN','EUR','USD','GBP','CHF','CZK')),
  listing_snapshot TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  decision_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  UNIQUE(buyer_id,client_key),
  CHECK(buyer_id<>seller_id),
  CHECK((kind='purchase' AND starts_on IS NULL AND ends_on IS NULL AND billing_unit='item' AND billing_periods=1 AND unit_deposit_amount=0 AND deposit_amount=0)
    OR (kind='rental' AND starts_on IS NOT NULL AND ends_on IS NOT NULL AND ends_on>starts_on AND billing_unit IN ('day','week','month'))),
  CHECK(subtotal_amount=unit_amount*quantity*billing_periods),
  CHECK(deposit_amount=unit_deposit_amount*quantity)
);
--> statement-breakpoint
CREATE INDEX robot_orders_buyer ON robot_orders(scope,buyer_id,updated_at DESC);
--> statement-breakpoint
CREATE INDEX robot_orders_seller ON robot_orders(scope,seller_id,updated_at DESC);
--> statement-breakpoint
CREATE INDEX robot_orders_capacity ON robot_orders(listing_id,status,kind,starts_on,ends_on);
