import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/src/sandbox/createSandboxRequire";

/**
 * Verifies the sandbox require reads one immutable mount manifest once.
 *
 * Repeated resolution of one immutable mount reads its manifest once, while a
 * second mount keeps independent manifest and module ownership.
 *
 * 1. Mount two packages whose manifests count their reads.
 * 2. Require the first package one hundred and one times and the second once,
 *    requiring identical first exports.
 * 3. Require each manifest to have been read exactly once and a missing package to
 *    throw.
 *
 * @evidence contracts/testing.md#behavioral-verification createSandboxRequire returns the same authored entry exports across 100 requests while each immutable mount's manifest getter is read exactly once.
 * @evidence contracts/testing.md#independent-expectations The fixture's own getters count real pack accesses independently of the resolver, and literal module exports identify the selected entries; no resolver-generated cache statistic is used.
 * @evidence contracts/testing.md#distinguishing-cases Repeated requests reuse one mount, a second mount reads its own manifest once and returns a different value, and an absent package still rejects rather than borrowing either cached entry.
 * @evidence contracts/testing.md#execution-ownership This exported source unit calls the authored sandbox require closure on an immutable in-memory pack; no consumer installation, filesystem tree, native artifact or child host is needed.
 */
export const test_create_sandbox_require_reuses_immutable_manifest_reads = (): void => {
  const reads = { first: 0, second: 0 };
  const pack: Record<string, string> = {
    get "first/package.json"() {
      reads.first++;
      return '{"exports":"./entry.cjs"}';
    },
    "first/entry.cjs": 'module.exports = { value: "first" };',
    get "second/package.json"() {
      reads.second++;
      return '{"exports":"./entry.cjs"}';
    },
    "second/entry.cjs": 'module.exports = { value: "second" };',
  };
  const require = createSandboxRequire(pack, { console });
  const first = require("first");
  for (let index = 0; index < 100; index++) assert.equal(require("first"), first);
  assert.deepEqual(first, { value: "first" });
  assert.deepEqual(require("second"), { value: "second" });
  assert.equal(reads.first, 1);
  assert.equal(reads.second, 1);
  assert.throws(() => require("missing"), /missing/);
};
