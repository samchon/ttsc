import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveRuntimeCleanTargets } from "../../../../packages/ttsc/src/launcher/internal/runtime/resolveRuntimeCleanTargets";

// This isolated source actor owns the private trace writer's first admission
// and deliberate terminal sink failure. It starts no product process.
const root = process.argv[2]!;
const cache = path.join(root, "cache");
const runs = path.join(cache, "ttsx/project");
const trace = path.join(root, "trace");
fs.mkdirSync(runs, { recursive: true });
fs.mkdirSync(trace);
const legacy = path.join(runs, "legacy");
const malformed = path.join(runs, "malformed");
const current = path.join(runs, "current");
const remote = path.join(runs, "remote");
for (const directory of [legacy, malformed, current, remote]) fs.mkdirSync(directory);
fs.writeFileSync(path.join(malformed, "owner-12.json"), "{");
fs.writeFileSync(path.join(current, "owner-" + process.pid + ".json"), JSON.stringify({ hostname: os.hostname(), pid: process.pid }));
fs.writeFileSync(path.join(remote, "owner-" + process.pid + ".json"), JSON.stringify({ hostname: os.hostname() + "-another-host", pid: process.pid }));
const expected = { kept: [legacy, malformed, current, remote].map((directory) => fs.realpathSync.native(directory)).sort(), targets: [] };
const check = () => {
  const plan = resolveRuntimeCleanTargets(cache);
  assert.deepEqual({ kept: plan.kept.sort(), targets: plan.targets }, expected);
};
delete process.env.TTSC_E2E_TRACE;
check();
assert.deepEqual(fs.readdirSync(trace), []);
process.env.TTSC_E2E_TRACE = trace;
check();
const files = fs.readdirSync(trace);
assert.equal(files.length, 1);
const sink = path.join(trace, files[0]!);
const events = fs.readFileSync(sink, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
assert.equal(events.every((event) => event.event === "runtime-cleanup" && event.data.origin === "runtime-clean-selection"), true);
for (const [directory, ownership] of [[legacy, "unowned"], [malformed, "unknown"], [current, "live"], [remote, "live"]]) {
  const rows = events.filter((event) => event.data.directory === fs.realpathSync.native(directory!));
  assert.deepEqual(rows.filter((event) => event.data.phase === "ownership").map((event) => event.data.ownership), [ownership]);
  assert.equal(rows.filter((event) => event.data.phase === "retention-selected").length, 1);
}
const observations = events.filter((event) => event.data.phase === "owner-observation").map((event) => event.data.ownerObservation.result).sort();
assert.deepEqual(observations, ["invalid-record", "present", "remote"]);

// A directory at the actual admitted append path causes native IO failure.
// The same ownership plan and native planner error must survive that failure.
fs.renameSync(sink, sink + ".saved");
fs.mkdirSync(sink);
assert.throws(() => fs.appendFileSync(sink, "not-a-file"));
check();
const invalidRoot = path.join(root, "\0");
let nativeError: unknown;
try { fs.realpathSync.native(path.join(invalidRoot, "ttsx/project")); }
catch (cause) { nativeError = cause; }
assert.ok(nativeError instanceof Error);
const expectedError = nativeError as NodeJS.ErrnoException;
assert.throws(() => resolveRuntimeCleanTargets(invalidRoot), (cause: unknown) =>
  cause instanceof Error && cause.name === expectedError.name &&
  (cause as NodeJS.ErrnoException).code === expectedError.code);
delete process.env.TTSC_E2E_TRACE;
check();
console.log(JSON.stringify({ disabled: true, observed: observations, sinkFailurePreservedPlan: true, nativeErrorPreserved: true }));
