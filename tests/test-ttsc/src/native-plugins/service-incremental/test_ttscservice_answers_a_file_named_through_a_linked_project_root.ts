import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscService } from "../../../../../packages/ttsc/lib/index.js";
import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { tsgo } from "../../internal/compiler";

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
 */
export const test_ttscservice_answers_a_file_named_through_a_linked_project_root =
  async () => {
    const root = TestProject.copyProject("ttsc-utility-plugins");
    TestUtilityPlugins.seedPackages(root);
    const link = path.join(TestProject.tmpdir("ttsc-service-link-"), "project");
    fs.symlinkSync(root, link, "junction");
    const service = new TtscService({
      binary: tsgo,
      cwd: link,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-resident-link-"),
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
  };
