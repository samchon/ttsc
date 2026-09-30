import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";

import { TtscService } from "../../../../../packages/ttsc/src/TtscService";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Constructs TtscService for a plain project and requires an error naming the missing transform-stage plugin.
 * @evidence contracts/testing.md#independent-expectations The service contract requires at least one transform plugin to create its resident host; the fixture contains none, so rejection is independent of compiler output.
 * @evidence contracts/testing.md#distinguishing-cases The zero-plugin negative isolates admission; actual resident requests, updates and disposal are exercised by the service/native protocol survivors.
 * @evidence contracts/testing.md#execution-ownership The named src/unit/api entry invokes the authored service constructor on a private fixture; its empty transform list rejects before selecting or spawning any native resident host.
 */
export const test_ttscservice_requires_a_transform_plugin = () => {
  const root = TestProject.commonJsProject({
    "src/main.ts": "export const value: number = 1;\n",
  });
  assert.throws(
    () => new TtscService({ cwd: root }),
    /at least one transform-stage plugin/,
  );
};
