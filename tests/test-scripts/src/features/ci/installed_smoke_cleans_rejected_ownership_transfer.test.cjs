const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");
const { test_installed_cli_smoke } = require("../../../../../scripts/ci/installed-cli-smoke.cjs");

/**
 * Verifies rejected ownership transfer cleans allocation even in keep mode.
 *
 * A callback that throws has not accepted the consumer, so the constructor
 * retains cleanup responsibility instead of leaving an unreachable directory.
 *
 * 1. Invoke kept smoke with a receiver that observes allocation and throws.
 * 2. Assert the original receiver error escapes before marker or install work.
 * 3. Verify the constructor removed its allocated directory.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual smoke allocation and constructor finally, checks the identical receiver error and verifies its owned directory is absent after rejected transfer.
 * @evidence contracts/testing.md#independent-expectations A deliberate receiver error establishes rejected transfer; no caller accepted cleanup ownership, so keep mode cannot retain this allocation.
 * @evidence contracts/testing.md#distinguishing-cases Covers callback failure before marker/archive/installation. The companion kept-borrow failure covers successful transfer and retained caller ownership.
 * @evidence contracts/testing.md#execution-ownership This named exported Node unit uses source allocation and native temporary filesystem checks only; it fails before packing, installation, native compilation or CLI execution and generic script unit discovery owns it.
 */
const test_installed_smoke_cleans_rejected_ownership_transfer = () => {
  const rejection = new Error("The receiver did not accept ownership");
  let consumer;
  try {
    assert.throws(() => test_installed_cli_smoke({
      keep: true,
      onConsumerCreated: (allocated) => {
        consumer = allocated;
        assert.equal(fs.existsSync(`${consumer}/.ttsc-cli-smoke`), false);
        throw rejection;
      },
    }), (error) => error === rejection);
    assert(consumer);
    assert.equal(fs.existsSync(consumer), false);
  } finally {
    if (consumer && fs.existsSync(consumer)) fs.rmSync(consumer, { recursive: true, force: true });
  }
};

module.exports = { test_installed_smoke_cleans_rejected_ownership_transfer };
test("cleans an allocation whose ownership callback rejects it", test_installed_smoke_cleans_rejected_ownership_transfer);
