ALTER TABLE listings ADD COLUMN submitted_edit_version INTEGER;
--> statement-breakpoint
CREATE INDEX listings_published_vin ON listings (
  scope, upper(replace(replace(json_extract(data,'$.vin'),' ',''),'-',''))
) WHERE status='published';
