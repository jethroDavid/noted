import { pool } from "./client";
import { countExpiredTextPosts, pruneExpiredTextPosts } from "./maintenance";

const dryRun = process.argv.includes("--dry-run");

try {
  if (dryRun) {
    const total = await countExpiredTextPosts();
    console.log(
      `Dry run: ${total} expired text post(s) would be deleted. No rows were changed.`,
    );
  } else {
    const removed = await pruneExpiredTextPosts();
    console.log(`Deleted ${removed} expired text post(s).`);
  }
} finally {
  await pool.end();
}
