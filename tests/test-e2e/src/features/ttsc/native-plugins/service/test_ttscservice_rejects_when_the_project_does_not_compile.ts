import { TestProject } from "@ttsc/testing";
import { ProjectFixtures } from "../../../../internal/ttsc/internal/ProjectFixtures";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscService } from "../../../../../../../packages/ttsc/lib/index.js";
import { TestUtilityPlugins } from "../../../../internal/ttsc/internal/TestUtilityPlugins";
import { tsgo } from "../../../../internal/ttsc/internal/compiler";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";

/**
 * Verifies TtscService.transformFile rejects when the project does not compile.
 *
 * The documented contract: a transform request rejects (rather than resolving
 * to an empty or stale result) when the resident host failed to compile the
 * project, so a real build error reaches the caller. The host exits non-zero at
 * startup on a type error, and the client surfaces that as a rejected request.
 *
 * Uses the shared utility-plugins fixture (so the constructor's plugin build
 * succeeds and the only failure is the type error), then breaks one source
 * file. Exercises the real native compiler and a Go linked host, so it runs in
 * CI.
 *
 * 1. Copy the fixture and replace src/main.ts with a non-compiling source.
 * 2. Construct a TtscService (the plugin build still succeeds).
 * 3. Assert transformFile rejects.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual TtscService transform request rejects when native startup compilation sees a string assigned to an exported number.
 * @evidence contracts/testing.md#independent-expectations The explicit incompatible assignment independently requires a compiler failure; a rejected public request distinguishes failure from an empty or stale success value.
 * @evidence contracts/testing.md#distinguishing-cases Owns failure during initial Program load rather than an update to a healthy session; successful transform/update/disposal cases execute in the shared resident survivor.
 * @evidence contracts/testing.md#execution-ownership The matching named service export constructs the actual public API and native host, then observes rejection in the Linux native batch.
 * @evidence contracts/e2e.md#necessary-boundary The native child nonzero startup must propagate through real process transport into a rejected API promise; pure diagnostic or message parsing units cannot prove that lifecycle connection.
 * @evidence contracts/e2e.md#shared-execution The unchanged linked utility producer shares the batch plugin cache and compiler objects with healthy service scenarios; the failed project alone needs its own process because no healthy Program can be loaded.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The incompatible source belongs to an isolated consumer fixture; try/finally disposes the failed service, and only immutable producer artifacts are reused across successful and failing consumers.
 * @evidence contracts/e2e.md#preserved-coverage The original assert.rejects remains, with the same incompatible source and actual compiled host; no success value is accepted to shorten this failure boundary.
 */
export async function test_ttscservice_rejects_when_the_project_does_not_compile(): Promise<void> {
  const root = ProjectFixtures.copy("ttsc-utility-plugins");
  TestUtilityPlugins.seedPackages(root);
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    'export const broken: number = "not a number";\n',
    "utf8",
  );
  const service = new TtscService({
    binary: tsgo,
    cwd: root,
    env: {
      PATH: TestUtilityPlugins.goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });
  try {
    await assert.rejects(() => service.transformFile("src/main.ts"));
  } finally {
    service.dispose();
  }
}
