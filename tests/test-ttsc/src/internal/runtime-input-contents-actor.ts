import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { RuntimeInputContents } from "../../../../packages/ttsc/src/compiler/internal/build/RuntimeInputContents";
import { PluginContentIdentities } from "../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";

// The named source unit owns this actual reader. Each capture opens a new
// identity store, as each process of a real run does, and the product's own
// trace reports how many files that capture read.
const root = process.argv[2]!;
const subject = path.join(root, "tsconfig.json");
const file = (name: string): string => path.join(root, name);
const digest = (text: string): string =>
  crypto.createHash("sha256").update(text).digest("hex");
/** Let the filesystem clock leave the tick of the last write. */
const settle = (): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60);
};
const capture = (names: string[]): Map<string, string | null> => {
  settle();
  const store = PluginContentIdentities.open({
    projectRoot: root,
    cacheDir: path.join(root, "cache"),
    env: process.env,
  });
  assert.ok(store);
  return new Map(
    RuntimeInputContents.capture(names.map(file), subject, store).map(
      ([name, , hash]) => [path.basename(name), hash],
    ),
  );
};

fs.writeFileSync(subject, "{}");
for (const name of ["a.ts", "b.ts", "c.ts"])
  fs.writeFileSync(file(name), `export const ${name[0]} = 1;`);

const first = capture(["a.ts", "b.ts", "c.ts"]);
const second = capture(["a.ts", "b.ts", "c.ts"]);
assert.deepEqual([...second], [...first]);
assert.equal(first.get("b.ts"), digest("export const b = 1;"));

// One edited file among unchanged ones.
fs.writeFileSync(file("b.ts"), "export const b = 2;");
const edited = capture(["a.ts", "b.ts", "c.ts"]);
assert.equal(edited.get("a.ts"), first.get("a.ts"));
assert.equal(edited.get("b.ts"), digest("export const b = 2;"));
assert.equal(edited.get("c.ts"), first.get("c.ts"));

// One added file, then a population that no longer selects one.
fs.writeFileSync(file("d.ts"), "export const d = 1;");
const added = capture(["a.ts", "b.ts", "c.ts", "d.ts"]);
assert.equal(added.get("d.ts"), digest("export const d = 1;"));
const narrowed = capture(["a.ts", "b.ts", "d.ts"]);
assert.equal(narrowed.get("d.ts"), added.get("d.ts"));

const reads = fs
  .readdirSync(process.env.TTSC_E2E_TRACE!)
  .filter((name) => name.endsWith(".jsonl"))
  .flatMap((name) =>
    fs
      .readFileSync(path.join(process.env.TTSC_E2E_TRACE!, name), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  )
  .filter((row) => row.data?.phase === "runtime-input-content")
  .map((row) => row.data.contentReads);
console.log(JSON.stringify({ reads }));
