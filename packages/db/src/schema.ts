import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";

// Scaffold-only heartbeat table proving Drizzle migrations run end to end.
// Phase 1 replaces it with the real homes/members/notes schema.
export const heartbeat = pgTable("heartbeat", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
