import assert from "node:assert/strict";

import { warnMissingFseventsBinding } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/warnMissingFseventsBinding.mjs";

/**
 * Verifies the watch broker says once, with its remedy, that macOS
 * notifications are off because the `fsevents` binding is missing
 * (samchon/ttsc#1425).
 *
 * Without the binding, every macOS registration is reported failed, which is
 * correct but makes each delivery validate its inputs against the disk. An
 * install that omitted optional dependencies would otherwise only be noticed as
 * slowness.
 *
 * 1. Listen for Node process warnings, and warn twice.
 * 2. Assert exactly one warning, with its code, naming the binding and how to
 *    restore it.
 */
export async function test_watch_broker_warns_once_without_the_fsevents_binding(): Promise<void> {
  const warnings: string[] = [];
  const listen = (warning: Error & { code?: string }): void => {
    if (warning.code === "TTSC_FSEVENTS_MISSING") {
      warnings.push(warning.message);
    }
  };
  process.on("warning", listen);
  try {
    warnMissingFseventsBinding();
    warnMissingFseventsBinding();
    // Node dispatches a process warning on a later tick.
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    process.off("warning", listen);
  }
  assert.equal(warnings.length, 1, "one warning per process");
  assert.ok(warnings[0]!.includes("`fsevents`"));
  assert.ok(warnings[0]!.includes("optional"));
}
