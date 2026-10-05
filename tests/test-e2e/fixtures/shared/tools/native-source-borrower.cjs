const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The existing runtime owner has installed its hooks before this preload.
// Borrow the actual shared publication only for these two orphan loads, then
// restore the installed compiler authority before the ordinary entry runs.
const root = path.dirname(__dirname);
const source = path.join(root, "node_modules/batch-native-source-race/index.ts");
const done = path.join(root, "tools/source-publication/source-race-done");
const report = path.join(root, "tools/source-publication/runtime-borrower.json");
const original = fs.readFileSync(source);
const names = ["TTSC_TSGO_BINARY", "ORPHAN_RACE_SOURCE", "ORPHAN_RACE_DONE", "ORPHAN_RACE_COMPILER"];
const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
assert.equal(fs.existsSync(done), false);
assert.equal(fs.existsSync(report), false);
assert.equal(typeof process.env.TTSC_E2E_SOURCE_PUBLICATION, "string");
assert.equal(typeof process.env.TTSC_E2E_ORPHAN_COMPILER, "string");
try {
  process.env.TTSC_TSGO_BINARY = process.env.TTSC_E2E_SOURCE_PUBLICATION;
  process.env.ORPHAN_RACE_COMPILER = process.env.TTSC_E2E_ORPHAN_COMPILER;
  process.env.ORPHAN_RACE_SOURCE = source;
  process.env.ORPHAN_RACE_DONE = done;
  const first = require(source).value;
  assert.equal(first, "two", "the real delegate changes the bytes that are actually lowered");
  assert.equal(fs.existsSync(done), true, "the native mutation branch must execute");
  assert.equal(fs.readFileSync(source, "utf8"), 'export const value: string = "two";\n');
  fs.writeFileSync(source, original);
  delete require.cache[require.resolve(source)];
  const second = require(source).value;
  assert.equal(second, "one", "the raced emit must not poison the original source key");
  fs.writeFileSync(report, JSON.stringify({ first, second, nativeMutation: true }));
} finally {
  fs.writeFileSync(source, original);
  for (const name of names) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
}
