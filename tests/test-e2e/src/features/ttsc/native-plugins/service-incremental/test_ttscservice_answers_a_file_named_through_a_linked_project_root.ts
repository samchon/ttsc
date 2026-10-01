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
 * @evidence contracts/testing.md#distinguishing-cases Owns logical linked project-root construction and linked absolute requests, contrasting the normal-root/nested-link session in the shared resident survivor.
 * @evidence contracts/testing.md#execution-ownership The matching named service-incremental export calls the actual public resident API over a native directory link in the Linux boundary batch.
 * @evidence contracts/e2e.md#necessary-boundary The constructor project identity and client file keys must agree with the physical Program loaded by the native child; direct path normalization does not prove that client-to-host framing.
 * @evidence contracts/e2e.md#shared-execution The immutable linked utility producer shares the batch plugin cache and Go objects; a distinct resident process is necessary to exercise the constructor with linked cwd rather than normal cwd.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The linked root and consumer source belong to private fixture directories, intentional update affects only this service, and try/finally disposes the child before TestProject cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original nonempty/banner, successful update, nonempty edited output and LINKED_EDIT assertions remain; normal-root nested alias behavior is consolidated separately without deleting this constructor distinction.
 */
export async function test_ttscservice_answers_a_file_named_through_a_linked_project_root(): Promise<void> {
  const root = ProjectFixtures.copy("ttsc-utility-plugins");
  TestUtilityPlugins.seedPackages(root);
  const link = path.join(TestProject.tmpdir("ttsc-service-link-"), "project");
  fs.symlinkSync(root, link, "junction");
  const service = new TtscService({
    binary: tsgo,
    cwd: link,
    env: {
      PATH: TestUtilityPlugins.goPath(),
      // The case observes path resolution, not a cold build, so it shares the
      // suite's plugin cache instead of compiling one more host.
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });
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
  } finally {
    service.dispose();
  }
}
