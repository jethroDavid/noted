// One-command demo content: user + "Family Kitchen" home + starter notes.
// Usage: pnpm db:seed -- --email owner@example.com --subject <firebase-uid>
// Run after the owner's first Google sign-in (the uid comes from the Firebase
// console); matching is by email so sign-in order does not matter.
// Fixture keys mirror PHOTO_FIXTURES in @noted/domain (this leaf package
// cannot import it); storage keys stay identical by construction below.
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import {
  boards,
  bookEntries,
  db,
  homeMemberships,
  homes,
  mediaAssets,
  posts,
  users,
} from "./index";

const FIXTURES = [
  { key: "lake", file: "lake.jpg", contentType: "image/jpeg" },
  { key: "living-room", file: "living-room.png", contentType: "image/png" },
  {
    key: "moonlit-bedroom",
    file: "moonlit-bedroom.png",
    contentType: "image/png",
  },
] as const;

const STARTER_NOTES = [
  {
    text: "Could you grab:\n\nOat milk\nStrawberries\nA little treat ♡",
    foregroundColor: "#33352e",
    backgroundColor: "#f5dfa0",
    x: 0.3,
    y: 0.4,
  },
  {
    text: "Movie night Friday — vote in the family chat!",
    foregroundColor: "#344e40",
    backgroundColor: "#dcd5ed",
    x: 0.62,
    y: 0.35,
  },
  {
    text: "Plumber booked Tue 9-11. Someone stay home 🙏",
    foregroundColor: "#813e4c",
    backgroundColor: "#f6f1df",
    x: 0.45,
    y: 0.62,
  },
] as const;

function readArg(name: string, fallback?: string): string {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index >= 0 && index + 1 < process.argv.length) {
    const value = process.argv[index + 1];
    if (value && !value.startsWith("--")) return value;
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required argument: ${flag} <value>`);
}

function fixtureByteSize(file: string): number {
  const dir = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../apps/web/public/fixtures",
  );
  try {
    return statSync(join(dir, file)).size;
  } catch {
    throw new Error(
      `Fixture file missing: ${file}. Extract apps/web/public/fixtures first.`,
    );
  }
}

async function main() {
  const email = readArg("email").trim().toLowerCase();
  const authSubject = readArg("subject");
  const homeName = readArg("home-name", "Family Kitchen");

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  let user = existingUser;
  if (!user) {
    [user] = await db
      .insert(users)
      .values({ authSubject, email, displayName: null })
      .returning();
    if (!user) throw new Error("Seed user insert returned no row.");
  } else if (user.authSubject !== authSubject) {
    throw new Error(
      `Email ${email} is already linked to a different sign-in subject.`,
    );
  }

  const [existingHome] = await db
    .select()
    .from(homes)
    .where(and(eq(homes.creatorUserId, user.id), eq(homes.name, homeName)))
    .limit(1);
  if (existingHome) {
    console.log(`Home "${homeName}" already exists; nothing to seed.`);
    process.exit(0);
  }

  const [home] = await db
    .insert(homes)
    .values({ name: homeName, creatorUserId: user.id })
    .returning();
  if (!home) throw new Error("Seed home insert returned no row.");
  await db.insert(homeMemberships).values({ homeId: home.id, userId: user.id });
  const [board] = await db
    .insert(boards)
    .values({ homeId: home.id, kind: "fridge" })
    .returning();
  if (!board) throw new Error("Seed board insert returned no row.");

  await db.insert(posts).values(
    STARTER_NOTES.map((note) => ({
      boardId: board.id,
      creatorUserId: user.id,
      kind: "text" as const,
      textContent: note.text,
      mediaAssetId: null,
      foregroundColor: note.foregroundColor,
      backgroundColor: note.backgroundColor,
      positionX: note.x,
      positionY: note.y,
    })),
  );

  const assets = await db
    .insert(mediaAssets)
    .values(
      FIXTURES.map((fixture) => ({
        homeId: home.id,
        kind: "photo" as const,
        state: "attached" as const,
        storageKey: `fixtures/${fixture.file}`,
        contentType: fixture.contentType,
        byteSize: fixtureByteSize(fixture.file),
        width: null,
        height: null,
      })),
    )
    .returning();
  const lake = assets.find((asset) => asset.storageKey === "fixtures/lake.jpg");
  const bedroom = assets.find(
    (asset) => asset.storageKey === "fixtures/moonlit-bedroom.png",
  );
  if (!lake || !bedroom) throw new Error("Seed fixture assets missing.");

  const [photoPost] = await db
    .insert(posts)
    .values({
      boardId: board.id,
      creatorUserId: user.id,
      kind: "photo",
      textContent: null,
      mediaAssetId: lake.id,
      positionX: 0.68,
      positionY: 0.62,
    })
    .returning();
  if (!photoPost) throw new Error("Seed photo post insert returned no row.");

  await db.insert(bookEntries).values({
    homeId: home.id,
    mediaAssetId: bedroom.id,
    archivedFromPostId: null,
    archivedByUserId: user.id,
  });

  await db
    .update(boards)
    .set({ postAdditions: STARTER_NOTES.length + 1 })
    .where(eq(boards.id, board.id));

  console.log(
    `Seeded "${homeName}" (${home.id}) for ${email}: ${STARTER_NOTES.length} text notes, 1 photo note, 1 archived photo.`,
  );
  process.exit(0);
}

await main();
