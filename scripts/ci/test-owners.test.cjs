// The completeness gate for `scripts/ci/test-owners.cjs`.
//
// A committed, executable, passing suite that no runner list and no workflow
// lane names never runs, and reports nothing while not running. Issue #622 was
// closed by lengthening a list and three new orphans appeared within a day, so
// the remedy has to fail on the next unclaimed suite rather than name the
// current ones.

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  OWNERSHIP,
  claimOf,
  discoverOwners,
  ownershipFailures,
} = require("./test-owners.cjs");

test("every committed test owner is claimed by an executor", () => {
  assert.deepEqual(ownershipFailures(), []);
});

test("discovery reads the tree, not a list", () => {
  const owners = discoverOwners();
  // The three families the repository actually has. A discovery that stopped
  // finding one of them would make the check above pass vacuously.
  for (const prefix of ["go:", "e2e:", "website:"])
    assert.ok(
      owners.some((owner) => owner.startsWith(prefix)),
      `discovery found no ${prefix} owner, so the gate proves nothing about that family`,
    );
  assert.ok(owners.length > 50, `only ${owners.length} owners discovered`);
});

test("an unclaimed owner fails, and a stale claim fails too", () => {
  // Both directions, exercised against the real predicate rather than a mock:
  // an id that cannot be claimed, and a claim for an id that cannot exist.
  assert.equal(claimOf("go:packages/ttsc/test/does-not-exist"), undefined);
  assert.equal(OWNERSHIP["e2e:test-does-not-exist"], undefined);
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
