import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const boardKind = pgEnum("board_kind", ["fridge"]);
export const postKind = pgEnum("post_kind", ["text", "photo", "voice"]);
export const mediaKind = pgEnum("media_kind", ["photo", "voice"]);
export const mediaState = pgEnum("media_state", [
  "pending",
  "attached",
  "expired",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authSubject: text("auth_subject").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_auth_subject_unique").on(table.authSubject),
    uniqueIndex("users_email_unique").on(table.email),
  ],
);

export const homes = pgTable("homes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  creatorUserId: uuid("creator_user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const homeMemberships = pgTable(
  "home_memberships",
  {
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.homeId, table.userId] }),
    index("home_memberships_user_idx").on(table.userId),
  ],
);

export const homeInvitations = pgTable(
  "home_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade", onUpdate: "cascade" }),
    targetEmail: text("target_email").notNull(),
    inviterUserId: uuid("inviter_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("home_invitations_email_idx").on(table.targetEmail),
    index("home_invitations_home_idx").on(table.homeId),
    check(
      "home_invitations_single_terminal_state",
      sql`not (${table.consumedAt} is not null and ${table.revokedAt} is not null)`,
    ),
  ],
);

export const boards = pgTable(
  "boards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade", onUpdate: "cascade" }),
    kind: boardKind("kind").notNull().default("fridge"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("boards_home_kind_unique").on(table.homeId, table.kind),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade", onUpdate: "cascade" }),
    kind: mediaKind("kind").notNull(),
    state: mediaState("state").notNull().default("pending"),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("media_assets_storage_key_unique").on(table.storageKey),
    index("media_assets_home_idx").on(table.homeId),
    check("media_assets_positive_bytes", sql`${table.byteSize} > 0`),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    creatorUserId: uuid("creator_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    kind: postKind("kind").notNull(),
    textContent: text("text_content"),
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    foregroundColor: text("foreground_color").notNull().default("#2a2118"),
    backgroundColor: text("background_color").notNull().default("#ffe890"),
    positionX: doublePrecision("position_x").notNull(),
    positionY: doublePrecision("position_y").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletionRequestedAt: timestamp("deletion_requested_at", {
      withTimezone: true,
    }),
    deleteAfter: timestamp("delete_after", { withTimezone: true }),
  },
  (table) => [
    index("posts_board_created_idx").on(table.boardId, table.createdAt),
    index("posts_delete_after_idx").on(table.deleteAfter),
    check(
      "posts_normalized_position",
      sql`${table.positionX} between 0 and 1 and ${table.positionY} between 0 and 1`,
    ),
    check(
      "posts_content_matches_kind",
      sql`(${table.kind} = 'text' and ${table.textContent} is not null and ${table.mediaAssetId} is null) or (${table.kind} in ('photo', 'voice') and ${table.textContent} is null and ${table.mediaAssetId} is not null)`,
    ),
    check(
      "posts_deletion_pair",
      sql`(${table.deletionRequestedAt} is null and ${table.deleteAfter} is null) or (${table.deletionRequestedAt} is not null and ${table.deleteAfter} is not null and ${table.deleteAfter} > ${table.deletionRequestedAt})`,
    ),
  ],
);
