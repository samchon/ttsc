import assert from "node:assert/strict";

import {
  TTSX_MINIMUM_NODE_VERSION,
  checkNodeRuntimeSupport,
} from "../../../../../packages/ttsc/lib/launcher/internal/runtimeHooks.js";

/**
 * Verifies ttsx diagnoses every Node.js version below its documented floor with
 * an actionable message and admits the floor and later.
 *
 * The runtime's highest requirement is synchronous `module.registerHooks` (Node
 * 22.15.0); the docs, `engines.node`, and this diagnostic must agree on that
 * floor. The e2e suite runs under a single Node version, so the boundary is
 * pinned by exercising the exported guard directly rather than by spawning many
 * runtimes. Below the floor the message must name the version and the missing
 * API instead of surfacing an internal `TypeError`.
 *
 * 1. Assert Node 18, 20, and 22.13 (below 22.15) each return a message that names
 *    the required version and `registerHooks`.
 * 2. Assert the floor 22.15.0 and a later 24.x return `null` (supported).
 * 3. Assert an unparseable version returns `null` rather than blocking on a
 *    parsing quirk.
 */
export const test_ttsx_diagnoses_unsupported_node_versions_at_the_documented_floor =
  () => {
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
  };
