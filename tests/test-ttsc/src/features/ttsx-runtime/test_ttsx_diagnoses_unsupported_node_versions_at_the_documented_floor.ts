import assert from "node:assert/strict";

import { TTSX_MINIMUM_NODE_VERSION } from "../../../../../packages/ttsc/src/launcher/internal/runtime/TTSX_MINIMUM_NODE_VERSION";
import { checkNodeRuntimeSupport } from "../../../../../packages/ttsc/src/launcher/internal/runtime/checkNodeRuntimeSupport";

/**
 * Verifies ttsx diagnoses every Node.js version below its documented floor with
 * an actionable message and admits the floor and later.
 *
 * The runtime's highest requirement is synchronous `module.registerHooks` (Node
 * 22.15.0). The suite runs under a single Node version, so the boundary is
 * pinned by exercising the exported guard directly rather than by spawning many
 * runtimes. (The test does not read the docs or `engines.node`.) Below the floor the message must name the version and the missing
 * API instead of surfacing an internal `TypeError`.
 *
 * 1. Assert Node 18.20.8, 20.20.2, 22.13.0 and 22.14.9 (all below 22.15) each
 *    return a message that names the required version, `registerHooks` and the
 *    rejected version itself.
 * 2. Assert the floor 22.15.0, 22.16.0, 24.3.0 and the `v`-prefixed v24.0.0
 *    return `null` (supported).
 * 3. Assert an unparseable version returns `null` rather than blocking on a
 *    parsing quirk.
 *
 * @evidence contracts/testing.md#behavioral-verification The production version guard returns actionable diagnostics below its public floor and permits supported versions.
 * @evidence contracts/testing.md#independent-expectations The supported Node API floor is 22.15.0, not a value computed by the guard; diagnostics independently name that API and each rejected version.
 * @evidence contracts/testing.md#distinguishing-cases Older major versions and the adjacent patch below the floor reject; exact floor, later releases, a v prefix and malformed text retain their documented outcomes.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttsx-runtime; it calls checkNodeRuntimeSupport with literal version strings and reads the exported TTSX_MINIMUM_NODE_VERSION constant, with no files, compiler, installation or process. The single assertion that the exported constant equals "22.15.0" only compares a constant with a literal.
 */
export function test_ttsx_diagnoses_unsupported_node_versions_at_the_documented_floor() {
    assert.equal(TTSX_MINIMUM_NODE_VERSION, "22.15.0");

    for (const version of ["18.20.8", "20.20.2", "22.13.0", "22.14.9"]) {
      const message = checkNodeRuntimeSupport(version);
      assert.notEqual(
        message,
        null,
        `expected ${version} to be diagnosed as unsupported`,
      );
      assert.match(message!, /22\.15\.0/);
      assert.match(message!, /registerHooks/);
      assert.match(message!, new RegExp(version.replace(/\./g, "\\.")));
    }

    // Floor and later releases are supported (no diagnostic).
    for (const version of ["22.15.0", "22.16.0", "24.3.0", "v24.0.0"]) {
      assert.equal(
        checkNodeRuntimeSupport(version),
        null,
        `expected ${version} to be supported`,
      );
    }

    // An unrecognizable version is not proof of an unsupported runtime.
    assert.equal(checkNodeRuntimeSupport("not-a-version"), null);
}