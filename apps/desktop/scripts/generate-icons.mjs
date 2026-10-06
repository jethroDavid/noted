// Builds the multi-resolution Windows icon from the committed brand
// artwork (mirrors the mobile shell's `assets` task). Run with
// `pnpm --filter @noted/desktop assets` after replacing icon.png.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "resources", "icon.png");
const sizes = [16, 24, 32, 48, 64, 128, 256];

const workdir = mkdtempSync(join(tmpdir(), "noted-desktop-icons-"));
try {
  const sized = [];
  for (const size of sizes) {
    const file = join(workdir, `icon-${size}.png`);
    await sharp(source).resize(size, size).png().toFile(file);
    sized.push(file);
  }
  writeFileSync(join(root, "resources", "icon.ico"), await pngToIco(sized));
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
