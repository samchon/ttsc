import { wrap } from "strict-dep";
// @ts-ignore -- the fixture installs no Node typings
import fs from "node:fs";
declare const process: { env: Record<string, string | undefined> };
const manifest = JSON.parse(
  fs.readFileSync(process.env.TTSX_RUNTIME_MANIFEST!, "utf8"),
) as { depCacheDir: string };
const files = fs.readdirSync(manifest.depCacheDir, {
  recursive: true,
}) as string[];
const built = files.some((file) => file.endsWith("unused.js"));
console.log("wrapped-" + wrap(7) + " project-built=" + built);
