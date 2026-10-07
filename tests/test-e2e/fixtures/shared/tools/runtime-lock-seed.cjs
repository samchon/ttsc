const { acquireDependencyBuildLock } = require(process.env.TTSC_E2E_LOCK_IMPLEMENTATION);
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
require(process.env.TTSC_E2E_REGISTER_IMPLEMENTATION);
const root = process.cwd();
const source = path.join(root, "src/main.ts");
const original = fs.readFileSync(source);
const marker = process.env.TTSC_E2E_REGISTER_MARKER;
const projectRuns = path.join(root, "node_modules/.cache/ttsc/ttsx/project");
assert.equal(fs.existsSync(marker), false);
assert.throws(() => require(source), (error) => {
  assert.match(String(error), /project check failed/);
  assert.match(String(error), /Type 'number' is not assignable to type 'string'/);
  return true;
});
assert.equal(fs.existsSync(marker), false, "the rejected included source must not write its marker");
assert.deepEqual(fs.existsSync(projectRuns) ? fs.readdirSync(projectRuns) : [], []);
try {
  const repaired = original.toString("utf8").replace("const invalid: string = 123;", 'const invalid: string = "healthy";');
  assert.notEqual(repaired, original.toString("utf8"));
  fs.writeFileSync(source, repaired);
  require(path.join(root, "test/first/index.ts"));
  assert.throws(() => require(path.join(root, "test/second/index.ts")), (error) => {
    assert.match(String(error), /entry check failed/);
    assert.match(String(error), /Type 'number' is not assignable to type 'string'/);
    return true;
  });
  assert.equal(fs.existsSync(marker), false, "the same-basename excluded source must fail before its marker");
} finally {
  fs.writeFileSync(source, original);
}
fs.writeFileSync(process.env.TTSC_E2E_REGISTER_DIAGNOSTICS, JSON.stringify({ includedRejected: true, firstExecuted: true, excludedRejected: true, markersAbsent: !fs.existsSync(marker) }));
// Checked preparation uses this namespace before the terminal lock is held.
// Holding it across the register builds would block the same compiler owner.
if (acquireDependencyBuildLock(process.env.TTSC_E2E_LOCK_DIRECTORY) === null)
  throw new Error("the lock was not acquired");
console.log("holder-acquired");
require(process.env.TTSC_E2E_MISSING_OWNED_SOURCE);
