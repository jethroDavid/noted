ALTER TABLE "boards" DROP CONSTRAINT "boards_home_id_homes_id_fk";
--> statement-breakpoint
ALTER TABLE "home_invitations" DROP CONSTRAINT "home_invitations_home_id_homes_id_fk";
--> statement-breakpoint
ALTER TABLE "home_invitations" DROP CONSTRAINT "home_invitations_inviter_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "home_memberships" DROP CONSTRAINT "home_memberships_home_id_homes_id_fk";
--> statement-breakpoint
ALTER TABLE "home_memberships" DROP CONSTRAINT "home_memberships_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "homes" DROP CONSTRAINT "homes_creator_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_home_id_homes_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_board_id_boards_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_creator_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_media_asset_id_media_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "home_invitations" ADD CONSTRAINT "home_invitations_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "home_invitations" ADD CONSTRAINT "home_invitations_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "home_memberships" ADD CONSTRAINT "home_memberships_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "home_memberships" ADD CONSTRAINT "home_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "homes" ADD CONSTRAINT "homes_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE cascade;