const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { test_installed_cli_smoke } = require("../../../../../scripts/ci/installed-cli-smoke.cjs");

/**
 * Verifies the allocated consumer transfers before a borrowed archive failure.
 *
 * A kept partial installation must remain reachable by its caller even when
 * smoke never returns. Missing real archives fail before any installer starts.
 *
 * 1. Allocate an empty owned archive directory and capture the callback root.
 * 2. Run the real smoke until the missing ttsc archive raises ENOENT.
 * 3. Verify transfer preceded marker creation and the retained root is owned.
 * 4. Remove only the two directories this case acquired.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual allocation, transfer and archive reader, asserts native ENOENT for the absent archive and that a failed kept borrow leaves its exact root accessible to its owner.
 * @evidence contracts/testing.md#independent-expectations The authored empty archive directory cannot provide ttsc.tgz; the callback must precede the smoke marker and failed preparation must not erase successfully transferred ownership.
 * @evidence contracts/testing.md#distinguishing-cases Covers successful transfer followed by preparation failure. The companion callback-rejection case owns constructor cleanup when transfer itself throws.
 * @evidence contracts/testing.md#execution-ownership This exported named Node unit calls source operations and real temporary filesystem primitives without installing, packing, building or launching a product host; generic unit scripts discovery runs it once.
 */
const test_installed_smoke_transfers_partial_borrow_ownership = () => {
  const archiveDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-smoke-empty-archives-"));
  let consumer;
  let markerAbsent;
  try {
    assert.throws(() => test_installed_cli_smoke({
      keep: true,
      archiveDirectory,
      onConsumerCreated: (allocated) => {
        consumer = allocated;
        markerAbsent = !fs.existsSync(path.join(consumer, ".ttsc-cli-smoke"));
      },
    }), (error) => error.code === "ENOENT" && error.path === path.join(fs.realpathSync.native(archiveDirectory), "ttsc.tgz"));
    assert.equal(markerAbsent, true);
    assert(consumer);
    assert.equal(fs.realpathSync.native(path.dirname(consumer)), fs.realpathSync.native(os.tmpdir()));
    assert(fs.lstatSync(consumer).isDirectory());
    assert(fs.existsSync(path.join(consumer, ".ttsc-cli-smoke")));
  } finally {
    if (consumer) fs.rmSync(consumer, { recursive: true, force: true });
    fs.rmSync(archiveDirectory, { recursive: true, force: true });
  }
  assert.equal(fs.existsSync(consumer), false);
  assert.equal(fs.existsSync(archiveDirectory), false);
};

module.exports = { test_installed_smoke_transfers_partial_borrow_ownership };
test("transfers the allocated consumer before a failed borrow", test_installed_smoke_transfers_partial_borrow_ownership);
