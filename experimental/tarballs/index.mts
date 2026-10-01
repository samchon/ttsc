import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Builds and packs the packages an external consumer installs: ttsc, the
// utility plugins, unplugin and this host's platform package.
const root = path.resolve(import.meta.dirname, "../..");
const names = [
  "ttsc",
  "banner",
  "lint",
  "paths",
  "strip",
  "unplugin",
  `ttsc-${process.platform}-${process.arch}`,
];

const pnpm = (args: string[], cwd: string) =>
  cp.execFileSync("pnpm", args, {
    cwd,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

pnpm(
  [...names.flatMap((name) => ["--filter", `./packages/${name}`]), "-r", "--workspace-concurrency=1", "build"],
  root,
);
for (const entry of fs.readdirSync(import.meta.dirname))
  if (entry.endsWith(".tgz")) fs.rmSync(path.join(import.meta.dirname, entry));
for (const name of names)
  pnpm(
    ["pack", "--out", path.join(import.meta.dirname, `${name}.tgz`)],
    path.join(root, "packages", name),
  );
