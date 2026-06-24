import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TtscService } from "../../../../../packages/ttsc/lib/index.js";
import { tsgo } from "../../internal/compiler";

/**
 * Verifies TtscService refuses a project with no transform-stage plugin.
 *
 * Resident mode runs through the linked-plugin shared host, the only binary
 * that exposes `serve`, so a project with only check plugins or none cannot be
 * served. The constructor must fail fast with a clear message rather than
 * spawning a host that has no `serve` subcommand. This throw happens before any
 * Go build (the plugin set is empty), so it needs no toolchain.
 *
 * 1. Create a plain project with no plugins.
 * 2. Assert constructing a TtscService throws the documented error.
 */
export const test_ttscservice_requires_a_transform_plugin = () => {
  const root = TestProject.commonJsProject({
    "src/main.ts": "export const value: number = 1;\n",
  });
  assert.throws(
    () => new TtscService({ binary: tsgo, cwd: root }),
    /at least one transform-stage plugin/,
  );
};
