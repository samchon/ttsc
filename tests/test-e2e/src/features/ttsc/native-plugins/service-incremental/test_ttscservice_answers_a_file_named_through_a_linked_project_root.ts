import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscService } from "../../../../../../../packages/ttsc/lib/index.js";
import { ProjectFixtures } from "../../../../internal/ttsc/internal/ProjectFixtures";
import { TestUtilityPlugins } from "../../../../internal/ttsc/internal/TestUtilityPlugins";
import { tsgo } from "../../../../internal/ttsc/internal/compiler";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";

/**
 * Verifies `TtscService` transforms and updates a file named through the link
 * the caller reached the project by.
 *
 * The resident host loads the project below its physical root and names its
 * files there. A file the caller named through a link, as every project in a
 * macOS temporary directory is named through `/var`, related to that root as a
 * path outside it: `transformFile` answered that the program has no such file,
 * and `updateFile` changed an overlay the program never read.
 *
 * 1. Link a directory to a project that declares a transform plugin, and start a
 *    service with the link as its cwd.
 * 2. Transform `src/main.ts` named through the link.
 * 3. Update it through the link, and assert the next transform carries the edit.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual service constructed with a linked cwd returns banner-bearing output for the linked source, accepts its update and returns the LINKED_EDIT marker.
 * @evidence contracts/testing.md#independent-expectations An explicit directory link and literal marker independently establish the request alias and updated content; the utility combo banner proves real linked transform execution.
 * @evidence contracts/testing.md#distinguishing-cases Owns linked project-root construction and linked absolute requests, distinct from the normal-root/nested-link named case whose actual execution requires separate evidence.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this generic named service-incremental entry, calling the actual built workspace public resident API over a native directory link.
 * @evidence contracts/e2e.md#necessary-boundary The constructor project identity and client file keys must agree with the physical Program loaded by the native child; direct path normalization does not prove that client-to-host framing.
 * @evidence contracts/e2e.md#shared-execution Linked utility inputs and explicit suite cache remain available, with a distinct constructed service selected by linked cwd. This does not certify hits, no rebuild, identical Program generations or total native process counts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Linked root/source belong to private tracked directories and updates affect this service. Root/link-parent/shared cache are retained before preparation because supported void disposal provides no awaited close acknowledgement. Body and disposal errors are aggregated; disposal/retention do not certify OS close or arbitrary descendants.
 * @evidence contracts/e2e.md#preserved-coverage Original nonempty/banner, successful update, nonempty edited output and LINKED_EDIT assertions remain; normal-root nested alias behavior is consolidated separately without deleting this constructor distinction.
 */
export async function test_ttscservice_answers_a_file_named_through_a_linked_project_root(): Promise<void> {
  const root = ProjectFixtures.copy("ttsc-utility-plugins");
  const retentionReason =
    "linked-root service has no awaited disposal acknowledgement";
  TestProject.retainTemporaryDirectory(root, retentionReason);
  TestProject.retainSharedPluginCache(retentionReason);
  TestUtilityPlugins.seedPackages(root);
  const linkParent = TestProject.tmpdir("ttsc-service-link-");
  TestProject.retainTemporaryDirectory(linkParent, retentionReason);
  const link = path.join(linkParent, "project");
  fs.symlinkSync(root, link, "junction");
  const service = new TtscService({
    binary: tsgo,
    cwd: link,
    env: {
      PATH: TestUtilityPlugins.goPath(),
      // The case observes path resolution, not a cold build, so it shares the
      // suite's available plugin cache without asserting an avoided build.
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });
  const failures: unknown[] = [];
  try {
    const file = path.join(link, "src", "main.ts");
    const before = await service.transformFile(file);
    assert.ok(before, "resident host returned no output for the linked file");
    TestUtilityPlugins.assertSingleBanner(before, "utility combo");

    const updated = await service.updateFile(
      file,
      'export const marker: string = "LINKED_EDIT";\n',
    );
    assert.equal(updated, true, "the resident host did not apply the update");
    const after = await service.transformFile(file);
    assert.ok(after, "resident host returned no output after the update");
    assert.match(after, /LINKED_EDIT/);
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      service.dispose();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "linked-root resident observation or disposal failed",
    );
}
