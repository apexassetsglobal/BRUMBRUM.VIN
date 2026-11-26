CREATE TABLE service_firms (
 id TEXT PRIMARY KEY, scope TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id), slug TEXT NOT NULL UNIQUE, client_key TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','published','rejected','deleted')), revision INTEGER NOT NULL DEFAULT 0,
 name TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', city_key TEXT NOT NULL DEFAULT '',
 address TEXT NOT NULL DEFAULT '', lat REAL, lon REAL, mobile INTEGER NOT NULL DEFAULT 0, facts TEXT NOT NULL DEFAULT '{}', fingerprint TEXT NOT NULL DEFAULT '',
 reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id,client_key)
);
--> statement-breakpoint
CREATE INDEX service_discovery ON service_firms(scope,status,country,city_key);
--> statement-breakpoint
CREATE TABLE service_categories (firm_id TEXT NOT NULL REFERENCES service_firms(id) ON DELETE CASCADE, category TEXT NOT NULL, PRIMARY KEY(firm_id,category));
--> statement-breakpoint
CREATE INDEX service_category_lookup ON service_categories(category,firm_id);
--> statement-breakpoint
CREATE TABLE service_media (id TEXT PRIMARY KEY, firm_id TEXT NOT NULL REFERENCES service_firms(id), kind TEXT NOT NULL, pair_key TEXT NOT NULL DEFAULT '', mime TEXT NOT NULL, size INTEGER NOT NULL, seq INTEGER NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX service_media_lookup ON service_media(firm_id,kind,seq);
--> statement-breakpoint
CREATE TABLE service_reviews (id TEXT PRIMARY KEY, firm_id TEXT NOT NULL REFERENCES service_firms(id), author_id TEXT NOT NULL REFERENCES users(id), stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5), content TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', reply TEXT NOT NULL DEFAULT '', reply_state TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, UNIQUE(firm_id,author_id));
--> statement-breakpoint
CREATE INDEX service_rating ON service_reviews(firm_id,state);
--> statement-breakpoint
CREATE TABLE service_reports (id TEXT PRIMARY KEY,scope TEXT NOT NULL,firm_id TEXT NOT NULL REFERENCES service_firms(id),review_id TEXT,actor TEXT NOT NULL REFERENCES users(id),reason TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE service_moderation (id TEXT PRIMARY KEY,scope TEXT NOT NULL,actor TEXT NOT NULL REFERENCES users(id),target_id TEXT NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE auto_policy (scope TEXT PRIMARY KEY, imports INTEGER NOT NULL DEFAULT 1,publish INTEGER NOT NULL DEFAULT 1,sync INTEGER NOT NULL DEFAULT 1,paused INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE auto_sources (id TEXT PRIMARY KEY,scope TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,kind TEXT NOT NULL,format TEXT NOT NULL DEFAULT 'auto',url TEXT NOT NULL DEFAULT '',credential TEXT NOT NULL DEFAULT '',token_origin TEXT NOT NULL DEFAULT '',push_hash TEXT NOT NULL DEFAULT '',mapping TEXT NOT NULL DEFAULT '{}',autopublish INTEGER NOT NULL DEFAULT 0,interval_hours INTEGER NOT NULL DEFAULT 0,enabled INTEGER NOT NULL DEFAULT 1,consent_at TEXT NOT NULL,created_at TEXT NOT NULL,next_at TEXT,last_at TEXT,UNIQUE(scope,owner_id,name));
--> statement-breakpoint
CREATE INDEX auto_due ON auto_sources(scope,enabled,next_at);
--> statement-breakpoint
CREATE TABLE auto_jobs (id TEXT PRIMARY KEY,scope TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id),source_id TEXT NOT NULL REFERENCES auto_sources(id),kind TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'queued',payload TEXT NOT NULL DEFAULT '',mapping TEXT NOT NULL DEFAULT '{}',snapshot INTEGER NOT NULL DEFAULT 0,cursor INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT 0,errors INTEGER NOT NULL DEFAULT 0,report TEXT NOT NULL DEFAULT '',lease TEXT,lease_until TEXT,created_at TEXT NOT NULL,finished_at TEXT,request_key TEXT,last_slice TEXT,UNIQUE(source_id,request_key));
--> statement-breakpoint
CREATE UNIQUE INDEX auto_single_work ON auto_jobs(source_id) WHERE state IN ('queued','running');
--> statement-breakpoint
CREATE INDEX auto_pending_jobs ON auto_jobs(scope,state,created_at);
--> statement-breakpoint
CREATE TABLE auto_items (source_id TEXT NOT NULL REFERENCES auto_sources(id),external_id TEXT NOT NULL,listing_id TEXT REFERENCES listings(id),fingerprint TEXT NOT NULL DEFAULT '',result TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',last_job TEXT NOT NULL,missing INTEGER NOT NULL DEFAULT 0,ever_published INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(source_id,external_id));
--> statement-breakpoint
CREATE TABLE auto_events (job_id TEXT NOT NULL REFERENCES auto_jobs(id),line INTEGER NOT NULL,external_id TEXT NOT NULL DEFAULT '',result TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',listing_id TEXT,PRIMARY KEY(job_id,line));
--> statement-breakpoint
CREATE TABLE auto_previews (id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES auto_sources(id),owner_id TEXT NOT NULL REFERENCES users(id),object_key TEXT NOT NULL,expires TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE auto_channels (id TEXT PRIMARY KEY,scope TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id),channel TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,credential TEXT NOT NULL DEFAULT '',token_origin TEXT NOT NULL DEFAULT '',consent_at TEXT NOT NULL,UNIQUE(owner_id,channel));
--> statement-breakpoint
CREATE TABLE auto_deliveries (id TEXT PRIMARY KEY,channel_id TEXT NOT NULL REFERENCES auto_channels(id),listing_id TEXT NOT NULL REFERENCES listings(id),revision INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'queued',detail TEXT NOT NULL DEFAULT '',attempts INTEGER NOT NULL DEFAULT 0,remote_job TEXT,lease_until TEXT,created_at TEXT NOT NULL,UNIQUE(channel_id,listing_id,revision));
--> statement-breakpoint
CREATE TABLE auto_clock (name TEXT PRIMARY KEY,last_at TEXT NOT NULL,next_at TEXT NOT NULL);

--> statement-breakpoint
CREATE TABLE auto_clients (scope TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id),enabled INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(scope,owner_id));
--> statement-breakpoint
CREATE TABLE auto_photo_steps (job_id TEXT NOT NULL REFERENCES auto_jobs(id),listing_id TEXT NOT NULL REFERENCES listings(id),position INTEGER NOT NULL,photo_id TEXT NOT NULL REFERENCES photos(id),PRIMARY KEY(job_id,listing_id,position));
