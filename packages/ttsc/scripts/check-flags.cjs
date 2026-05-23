// CI gate: re-run gen-flags.mts and fail if any generated file changed on
// disk relative to the committed copy. Mirrors the pattern used by the
// gen_shims tool — committed output is the spec, drift means someone edited
// a generated file by hand without updating schema.ts.

"use strict";

const child = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const here = __dirname;
const ttscRoot = path.resolve(here, "..");
const repoRoot = path.resolve(ttscRoot, "../..");

const targets = [
  path.join(ttscRoot, "cmd/ttsc/flags_gen.go"),
  path.join(ttscRoot, "utility/flags_gen.go"),
  path.join(repoRoot, "packages/lint/linthost/flags_gen.go"),
  path.join(repoRoot, "website/src/content/docs/ttsc/flags.mdx"),
];

const before = snapshot(targets);

const result = child.spawnSync(
  process.execPath,
  ["--experimental-strip-types", path.join(here, "gen-flags.mts")],
  { stdio: "inherit" },
);
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

// gofmt the generated Go files so alignment matches the committed copy. The
// generator emits raw key:value entries and gofmt aligns the `:` column;
// skipping this step here would surface as drift on any local edit.
for (const target of targets) {
  if (!target.endsWith(".go")) continue;
  const gofmt = child.spawnSync(
    path.join(repoRoot, ".vscode/gofmt-2spaces.sh"),
    ["-w", target],
    { stdio: "inherit" },
  );
  if (gofmt.status !== 0) {
    process.exit(gofmt.status ?? 1);
  }
}

const after = snapshot(targets);
const drift = [];
for (const target of targets) {
  if (before[target] !== after[target]) {
    drift.push(target);
  }
}
if (drift.length !== 0) {
  process.stderr.write(
    "ttsc flag schema: generated output drifted from src/flags/schema.ts:\n",
  );
  for (const file of drift) {
    process.stderr.write(`  ${path.relative(repoRoot, file)}\n`);
  }
  process.stderr.write(
    "run `pnpm format` to regenerate and commit the result.\n",
  );
  process.exit(1);
}

process.stdout.write("ttsc flag schema: generated output matches schema.\n");

function snapshot(files) {
  const out = {};
  for (const file of files) {
    out[file] = fs.existsSync(file)
      ? fs.readFileSync(file, "utf8")
      : "";
  }
  return out;
}
