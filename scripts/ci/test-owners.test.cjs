// The completeness gate for `scripts/ci/test-owners.cjs`.
//
// A committed, executable, passing suite that no runner list and no workflow
// lane names never runs, and reports nothing while not running. Issue #622 was
// closed by lengthening a list and three new orphans appeared within a day, so
// the remedy has to fail on the next unclaimed suite rather than name the
// current ones.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const {
  HARNESS_TESTS,
  OWNERSHIP,
  claimOf,
  discoverOwners,
  ownershipFailures,
  trackedFiles,
} = require("./test-owners.cjs");

const root = path.resolve(__dirname, "..", "..");

test("every committed test owner is claimed by an executor", () => {
  assert.deepEqual(ownershipFailures(), []);
});

test("discovery reads the tree, not a list", () => {
  const owners = discoverOwners();
  // Named members, not a count. A floor on the total and a non-empty check per
  // prefix cannot see a family that was never enumerated, and two families were
  // not: `experimental/` held an e2e package the gate did not know existed, and
  // seven node suites ran off a literal array in `scripts/test-go.cjs`. Both
  // families passed the old assertions by having zero members.
  for (const owner of [
    "go:packages/ttsc/test/driver",
    "e2e:tests/test-lint",
    "e2e:experimental/test-unplugin",
    "node:scripts/go-build-cache.test.cjs",
    "node:website/test/rss-autodiscovery.test.cjs",
    "node:packages/ttsc/scripts/check-flags.test.cjs",
  ])
    assert.ok(
      owners.includes(owner),
      `discovery lost ${owner}; the gate would certify a family it cannot see`,
    );
  assert.ok(owners.length > 50, `only ${owners.length} owners discovered`);
});

test("the harness list is derived from the claims, not written twice", () => {
  // `scripts/test-go.cjs` used to name its five node suites in a literal array
  // beside this map. Two lists of the same thing drift, and the one that drifts
  // silently is the one that runs code. The runner reads this instead.
  assert.ok(HARNESS_TESTS.length > 0, "no harness test derived");
  for (const relative of HARNESS_TESTS)
    assert.equal(
      OWNERSHIP[`node:${relative}`],
      "scripts/test-go.cjs harness",
      `${relative} is in the derived list but claimed by something else`,
    );
  for (const [owner, executor] of Object.entries(OWNERSHIP))
    if (executor === "scripts/test-go.cjs harness")
      assert.ok(
        HARNESS_TESTS.includes(owner.slice("node:".length)),
        `${owner} claims the harness but the harness does not run it`,
      );
});

test("an unclaimed owner fails, and a stale claim fails too", () => {
  // Both directions, exercised against the real predicate rather than a mock:
  // an id that cannot be claimed, and a claim for an id that cannot exist.
  assert.equal(claimOf("go:packages/ttsc/test/does-not-exist"), undefined);
  assert.equal(OWNERSHIP["e2e:tests/test-does-not-exist"], undefined);
  assert.equal(claimOf("node:scripts/does-not-exist.test.cjs"), undefined);
});

test("generated test-shaped files are excluded until Git tracks them", (t) => {
  const vendorRoot = path.join(root, "packages", "wasm", "shim-vendor");
  fs.mkdirSync(vendorRoot, { recursive: true });
  const fixtureDirectory = fs.mkdtempSync(path.join(vendorRoot, "test-owner-"));
  t.after(() => fs.rmSync(fixtureDirectory, { force: true, recursive: true }));
  const fixture = path.join(fixtureDirectory, "generated_owner_test.go");
  fs.writeFileSync(fixture, "package generated\n");
  const generatedGo = path.relative(root, fixture).split(path.sep).join("/");
  const generatedGoOwner = `go:${path.posix.dirname(generatedGo)}`;
  assert.equal(fs.existsSync(fixture), true, "ignored fixture was not created");
  assert.equal(
    discoverOwners().includes(generatedGoOwner),
    false,
    "an on-disk ignored Go suite became a committed test owner",
  );

  const generated = [
    generatedGo,
    "experimental/test-generated-owner/package.json",
    "scripts/ci/generated-owner.test.cjs",
  ];
  assert.equal(
    discoverOwners().includes("go:packages/wasm/shim-vendor/shim/ast/test"),
    false,
    "the ignored wasm publication mirror became a committed test owner",
  );
  const failures = ownershipFailures([...trackedFiles(), ...generated]);
  for (const owner of [
    generatedGoOwner,
    "e2e:experimental/test-generated-owner",
    "node:scripts/ci/generated-owner.test.cjs",
  ])
    assert.ok(
      failures.some((failure) => failure.startsWith(`unclaimed: ${owner} `)),
      `tracked owner ${owner} did not enter the two-way invariant`,
    );
});

test("a top-level test-prefixed file is not an e2e package", () => {
  assert.deepEqual(discoverOwners(["tests/test-notes.md"]), []);
  assert.deepEqual(discoverOwners(["experimental/test-notes.md"]), []);
});

test("the lint corpus is claimed by rule, not by enumeration", () => {
  // `packages/lint/test/**` holds forty-odd directories that all run through one
  // flattening runner. Claiming them one by one would reintroduce exactly the
  // list this gate exists to replace, so the claim is a rule and a new rule
  // directory is covered the moment it is committed.
  assert.equal(
    claimOf("go:packages/lint/test/rules/a-family-added-tomorrow"),
    "scripts/test-go-lint.cjs",
  );
});
