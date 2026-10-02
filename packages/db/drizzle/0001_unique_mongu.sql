ALTER TYPE "public"."media_kind" ADD VALUE 'video';--> statement-breakpoint
CREATE TABLE "reels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"creator_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "thumbnail_key" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "poster_key" text;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "reels_home_idx" ON "reels" USING btree ("home_id");