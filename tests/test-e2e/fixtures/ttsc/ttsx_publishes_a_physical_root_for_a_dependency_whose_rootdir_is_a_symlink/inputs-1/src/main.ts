declare function require<T = unknown>(name: string): T;
declare const process: { env: Record<string, string | undefined> };

const dep = require<{ VALUE: string }>("dep");
const dep2 = require<{ VALUE2: string }>("dep2");
const fs = require<{
  readFileSync(file: string, encoding: string): string;
  readdirSync(directory: string): string[];
}>("node:fs");
const path = require<{ join(...parts: string[]): string }>(
  "node:path",
);

const manifest = JSON.parse(
  fs.readFileSync(process.env.TTSX_RUNTIME_MANIFEST ?? "", "utf8"),
) as { depCacheDir: string };
const roots = fs
  .readdirSync(manifest.depCacheDir)
  .filter((name) => name.endsWith(".json"))
  .map(
    (name) =>
      (
        JSON.parse(
          fs.readFileSync(path.join(manifest.depCacheDir, name), "utf8"),
        ) as { rootDir: string }
      ).rootDir,
  );

console.log("VALUE:" + dep.VALUE + "/" + dep2.VALUE2);
console.log("ROOTS:" + JSON.stringify(roots));
