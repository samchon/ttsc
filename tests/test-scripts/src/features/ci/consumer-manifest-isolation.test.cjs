const assert = require("node:assert/strict");
const { test } = require("node:test");
const { consumerDependencies } = require("../../../../../scripts/ci/consumer-dependencies.cjs");

/**
 * Verifies consumer dependency selection preserves direct installation identities.
 *
 * A consumer must not inherit another consumer's compiler alias or plugin.
 *
 * 1. Select scoped and aliased direct dependencies from a shared installation.
 * 2. Reject missing or non-string entries and preserve the empty selection.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls consumerDependencies and compares the complete selected object, distinguishing leaked dependencies and rewritten compiler identities from the requested consumer's direct entries.
 * @evidence contracts/testing.md#independent-expectations The fixture explicitly declares each installed identity and requested direct name; expected subsets follow those inputs without executing the selector to construct them.
 * @evidence contracts/testing.md#distinguishing-cases Scoped package and npm alias selections retain their values, an empty consumer receives no entries, and missing or non-string identities must fail rather than silently omit a dependency.
 * @evidence contracts/testing.md#execution-ownership Node registers this exported test_consumer_manifest_isolation function once; it calls the selector in process without an installation or product host.
 */
const test_consumer_manifest_isolation = () => {
  const installed = {
    compiler: "file:./compiler.tgz",
    "@scope/adapter": "^1.0.0",
    classic: "npm:typescript@6.0.3",
    native: "npm:typescript@7.0.2",
    lint: "file:./lint.tgz",
  };
  assert.deepEqual(consumerDependencies(installed, [
    "compiler", "@scope/adapter@^1.0.0", "classic@npm:typescript@6.0.3",
  ]), {
    compiler: installed.compiler,
    "@scope/adapter": installed["@scope/adapter"],
    classic: installed.classic,
  });
  assert.deepEqual(consumerDependencies(installed, ["native@npm:typescript@7.0.2", "lint"]), {
    native: installed.native, lint: installed.lint,
  });
  assert.deepEqual(consumerDependencies(installed, []), {});
  assert.throws(() => consumerDependencies(installed, ["absent@1.0.0"]), /missing dependency absent/);
  assert.throws(() => consumerDependencies({ broken: null }, ["broken"]), /missing dependency broken/);
};

module.exports = { test_consumer_manifest_isolation };

test("shared installation retains each consumer's direct dependency identities", test_consumer_manifest_isolation);
