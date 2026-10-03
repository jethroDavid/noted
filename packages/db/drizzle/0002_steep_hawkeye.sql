ALTER TABLE "book_entries" ADD COLUMN "archived_from_reel_id" uuid;--> statement-breakpoint
CREATE INDEX "reels_created_idx" ON "reels" USING btree ("created_at");