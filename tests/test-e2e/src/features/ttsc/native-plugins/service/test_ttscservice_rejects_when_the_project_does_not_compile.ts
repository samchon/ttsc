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
 * Uses the linked utility-plugins fixture and an incompatible source in an
 * actual resident request. The rejection assertion does not independently
 * attribute the failure to type checking or inspect constructor build success.
 *
 * 1. Copy the fixture and replace src/main.ts with a non-compiling source.
 * 2. Construct the actual TtscService against the authored project.
 * 3. Assert transformFile rejects.
 *
 * @evidence contracts/testing.md#behavioral-verification An actual TtscService transform request rejects for the authored incompatible string-to-number project. The original rejection predicate does not inspect a compiler diagnostic, native exit status or every possible rejection cause.
 * @evidence contracts/testing.md#independent-expectations The explicit incompatible assignment independently requires a compiler failure; a rejected public request distinguishes failure from an empty or stale success value.
 * @evidence contracts/testing.md#distinguishing-cases Keeps incompatible startup source separate from healthy-session updates. Healthy transformation/update/disposal have a separate named owner and require their own actual execution evidence.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named generic service entry, which constructs the actual built workspace API/native host and observes a public request rejection.
 * @evidence contracts/e2e.md#necessary-boundary The authored incompatible project is submitted through the real resident startup/request connection, not a fabricated reply or direct parser. Public rejection alone does not independently certify a nonzero child status or exact native compilation cause.
 * @evidence contracts/e2e.md#shared-execution The linked utility inputs and explicit suite cache remain available across separate healthy/failing consumers. This construction is distinct and does not reuse a healthy service or certify cache hits, identical Program objects or avoided builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Incompatible source belongs to the tracked copied root. Supported void disposal is attempted, with body/disposal errors aggregated, but it does not await actual child close. Root/already-owned shared plugin cache are conservatively retained before preparation; no restoration or cleanup is authorized by rejection/disposal alone.
 * @evidence contracts/e2e.md#preserved-coverage The original assert.rejects remains, with the same incompatible source and actual compiled host; no success value is accepted to shorten this failure boundary.
 */
export async function test_ttscservice_rejects_when_the_project_does_not_compile(): Promise<void> {
  const root = ProjectFixtures.copy("ttsc-utility-plugins");
  const retentionReason = "failed resident startup has no awaited disposal acknowledgement";
  TestProject.retainTemporaryDirectory(root, retentionReason);
  TestProject.retainSharedPluginCache(retentionReason);
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
  const failures: unknown[] = [];
  try {
    await assert.rejects(() => service.transformFile("src/main.ts"));
  } catch (error) {
    failures.push(error);
  } finally {
    try { service.dispose(); }
    catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "failed-startup rejection or disposal assertion failed");
}
