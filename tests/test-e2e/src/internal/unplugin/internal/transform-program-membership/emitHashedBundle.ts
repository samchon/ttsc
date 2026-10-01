import fs from "node:fs";
import path from "node:path";

/** Write one content-hashed bundle, replacing the previous build's. */
export function emitHashedBundle(
  root: string,
  directory: string,
  build: number,
): void {
  const target = path.join(root, directory);
  fs.mkdirSync(target, { recursive: true });
  for (const stale of fs.readdirSync(target)) {
    fs.rmSync(path.join(target, stale), { force: true, recursive: true });
  }
  fs.writeFileSync(
    path.join(target, `bundle.${build}${build}${build}abcd.js`),
    `// build ${build}\n`,
    "utf8",
  );
}
