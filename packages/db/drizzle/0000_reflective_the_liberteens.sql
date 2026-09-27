CREATE TYPE "public"."board_kind" AS ENUM('fridge');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('photo');--> statement-breakpoint
CREATE TYPE "public"."media_state" AS ENUM('pending', 'attached', 'expired');--> statement-breakpoint
CREATE TYPE "public"."post_kind" AS ENUM('text', 'photo');--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_id" uuid NOT NULL,
	"kind" "board_kind" DEFAULT 'fridge' NOT NULL,
	"post_additions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"archived_from_post_id" uuid,
	"archived_by_user_id" uuid NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_id" uuid NOT NULL,
	"target_email" text NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "home_invitations_single_terminal_state" CHECK (not ("home_invitations"."consumed_at" is not null and "home_invitations"."revoked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "home_memberships" (
	"home_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_memberships_home_id_user_id_pk" PRIMARY KEY("home_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "homes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"creator_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"state" "media_state" DEFAULT 'pending' NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_positive_bytes" CHECK ("media_assets"."byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"creator_user_id" uuid NOT NULL,
	"kind" "post_kind" NOT NULL,
	"text_content" text,
	"media_asset_id" uuid,
	"foreground_color" text DEFAULT '#2a2118' NOT NULL,
	"background_color" text DEFAULT '#ffe890' NOT NULL,
	"position_x" double precision NOT NULL,
	"position_y" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_normalized_position" CHECK ("posts"."position_x" between 0 and 1 and "posts"."position_y" between 0 and 1),
	CONSTRAINT "posts_content_matches_kind" CHECK (("posts"."kind" = 'text' and "posts"."text_content" is not null and "posts"."media_asset_id" is null) or ("posts"."kind" = 'photo' and "posts"."text_content" is null and "posts"."media_asset_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_subject" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "book_entries" ADD CONSTRAINT "book_entries_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "book_entries" ADD CONSTRAINT "book_entries_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "book_entries" ADD CONSTRAINT "book_entries_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "home_invitations" ADD CONSTRAINT "home_invitations_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "home_invitations" ADD CONSTRAINT "home_invitations_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "home_memberships" ADD CONSTRAINT "home_memberships_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "home_memberships" ADD CONSTRAINT "home_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "homes" ADD CONSTRAINT "homes_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "boards_home_kind_unique" ON "boards" USING btree ("home_id","kind");--> statement-breakpoint
CREATE INDEX "book_entries_home_idx" ON "book_entries" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "home_invitations_email_idx" ON "home_invitations" USING btree ("target_email");--> statement-breakpoint
CREATE INDEX "home_invitations_home_idx" ON "home_invitations" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "home_memberships_user_idx" ON "home_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_home_storage_key_unique" ON "media_assets" USING btree ("home_id","storage_key");--> statement-breakpoint
CREATE INDEX "media_assets_home_idx" ON "media_assets" USING btree ("home_id");--> statement-breakpoint
CREATE INDEX "posts_board_created_idx" ON "posts" USING btree ("board_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_subject_unique" ON "users" USING btree ("auth_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");