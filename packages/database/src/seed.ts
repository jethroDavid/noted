import { sql } from "drizzle-orm";

import { database, pool } from "./client";

const aliceId = "00000000-0000-4000-8000-000000000001";
const bobId = "00000000-0000-4000-8000-000000000002";
const homeId = "00000000-0000-4000-8000-000000000010";
const boardId = "00000000-0000-4000-8000-000000000020";

try {
  await database.transaction(async (transaction) => {
    await transaction.execute(sql`
      insert into users (id, auth_subject, email, display_name)
      values
        (${aliceId}, 'demo-alice', 'alice@example.test', 'Alice'),
        (${bobId}, 'demo-bob', 'bob@example.test', 'Bob')
      on conflict (id) do update set
        auth_subject = excluded.auth_subject,
        email = excluded.email,
        display_name = excluded.display_name
    `);

    await transaction.execute(sql`
      insert into homes (id, name, creator_user_id)
      values (${homeId}, 'The Example Home', ${aliceId})
      on conflict (id) do update set
        name = excluded.name,
        creator_user_id = excluded.creator_user_id,
        updated_at = now()
    `);

    await transaction.execute(sql`
      insert into home_memberships (home_id, user_id)
      values (${homeId}, ${aliceId}), (${homeId}, ${bobId})
      on conflict (home_id, user_id) do nothing
    `);

    await transaction.execute(sql`
      insert into boards (id, home_id, kind)
      values (${boardId}, ${homeId}, 'fridge')
      on conflict (id) do update set home_id = excluded.home_id
    `);
  });

  console.log("Seeded Alice, Bob, their example home, and its fridge board.");
} finally {
  await pool.end();
}
