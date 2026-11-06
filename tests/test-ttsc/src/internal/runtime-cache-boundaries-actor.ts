import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { RuntimeEmitBundle } from "../../../../packages/ttsc/src/compiler/internal/build/RuntimeEmitBundle";
import { RuntimeInputContents } from "../../../../packages/ttsc/src/compiler/internal/build/RuntimeInputContents";
import { PluginContentIdentities } from "../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";

// The named source unit owns this actual reader and its independent memory,
// byte and native timestamp expectations. No compiler or product host runs.
const root = process.argv[2]!;
const emit = path.join(root, "emit");
crypto.createHash("sha256").update("warm").digest();
assert.ok(global.gc);
global.gc();
global.gc();
const before = process.memoryUsage();
const bundle = RuntimeEmitBundle.open(emit)!;
assert.equal(bundle.read(path.join(emit, "main.js")), "exports.value = 7;");
global.gc();
global.gc();
const after = process.memoryUsage();
const retained =
  after.heapUsed + after.external - before.heapUsed - before.external;
assert.ok(
  retained < 8 * 1024 * 1024,
  `one tiny module retained ${retained} bytes beside an unloaded 40 MiB output`,
);
assert.deepEqual(bundle.outputs(), ["main.js"]);

const subject = path.join(root, "tsconfig.json");
fs.writeFileSync(subject, "{}");
const store = PluginContentIdentities.open({
  projectRoot: root,
  cacheDir: path.join(root, "cache"),
  env: process.env,
});
assert.ok(store);
const source = path.join(root, "source.ts");
fs.writeFileSync(source, "export const value = 1;");
fs.utimesSync(source, new Date(1000), new Date(1000));
const stats = fs.statSync(source, { bigint: true });
const reference = store.references.get(stats.dev);
assert.ok(
  reference !== undefined &&
    stats.mtimeNs < reference &&
    stats.ctimeNs >= reference,
  "the real post-reference source must have an old mtime and a fresh change stamp",
);
RuntimeInputContents.capture([source], subject, store);
RuntimeInputContents.capture([source], subject, store);
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
assert.deepEqual(
  reads,
  [1, 1],
  "a fresh change-time tick requires actual content reads on both captures",
);
console.log(JSON.stringify({ retained, reads }));
