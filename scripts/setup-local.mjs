import { copyFile, mkdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const environmentFile = path.join(repositoryRoot, ".env");
const exampleFile = path.join(repositoryRoot, ".env.example");

async function exists(filePath) {
  try {
    await stat(filePath, { bigint: false });
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

await mkdir(path.join(repositoryRoot, ".local", "uploads"), {
  recursive: true,
});
if (!(await exists(environmentFile))) {
  await copyFile(exampleFile, environmentFile, constants.COPYFILE_EXCL);
  console.log("Created .env from .env.example.");
} else {
  console.log("Kept the existing .env file.");
}

console.log("Local data directories are ready under .local/.");
