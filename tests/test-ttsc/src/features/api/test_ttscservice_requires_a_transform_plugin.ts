import assert from "node:assert/strict";

import { TtscService } from "../../../../../packages/ttsc/src/TtscService";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies TtscService refuses a project with no transform-stage plugin.
 *
 * The service requires a transform-stage plugin before selecting its resident
 * host. A project with none must fail fast with a clear message before any Go
 * build or host spawn, so this admission check needs no toolchain.
 *
 * 1. Create a plain project with no plugins.
 * 2. Assert constructing a TtscService throws the documented error.
 *
 * @evidence contracts/testing.md#behavioral-verification Constructs TtscService for a plain project and requires an error naming the missing transform-stage plugin.
 * @evidence contracts/testing.md#independent-expectations The service contract requires at least one transform plugin to create its resident host; the fixture contains none, so rejection is independent of compiler output.
 * @evidence contracts/testing.md#distinguishing-cases Only the zero-plugin negative is exercised: a plain commonjs project with no plugins entry must make the constructor throw the transform-stage-plugin error; a project that does declare a transform plugin is not constructed here.
 * @evidence contracts/testing.md#execution-ownership The named src/features/api entry invokes the authored service constructor on a private fixture; its empty transform list rejects before selecting or spawning any native resident host.
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
