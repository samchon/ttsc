import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { TtscService } from "../../../../../packages/ttsc/lib/index.js";
import { tsgo } from "../../internal/compiler";
import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";

/**
 * Verifies TtscService reflects a file update through the resident host.
 *
 * The incremental half of the resident host (samchon/ttsc#255): an editor or
 * watch consumer feeds an unsaved buffer through `updateFile`, and the next
 * `transformFile` must return the edited source, re-run through the linked
 * plugins, without restarting the host. This is what makes the service
 * incremental rather than merely resident.
 *
 * Uses the shared utility-plugins fixture (banner/paths/strip share one linked
 * host). Exercises the real native compiler and a Go linked host, so it runs in
 * CI.
 *
 * 1. Transform `src/main.ts` and confirm the banner ran on the original source.
 * 2. Update `src/main.ts` with new content and confirm the rebuild succeeded.
 * 3. Re-transform and confirm the new content is returned, the plugins re-ran
 *    (banner still present), and the original source is gone.
 */
export const test_ttscservice_reflects_a_file_update_through_the_resident_host =
  async () => {
    const root = TestProject.copyProject("ttsc-utility-plugins");
    TestUtilityPlugins.seedPackages(root);
    const service = new TtscService({
      binary: tsgo,
      cwd: root,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-resident-update-"),
      },
    });
    try {
      const before = await service.transformFile(
        path.join(root, "src", "main.ts"),
      );
      assert.ok(before, "resident host returned no output before the update");
      TestUtilityPlugins.assertSingleBanner(before, "utility combo");
      assert.match(before, /join\(/, "fixture should call join before the edit");

      const updated = await service.updateFile(
        path.join(root, "src", "main.ts"),
        'export const marker: string = "RESIDENT_EDIT";\n',
      );
      assert.equal(updated, true, "the resident host failed to apply the update");

      const after = await service.transformFile("src/main.ts");
      assert.ok(after, "resident host returned no output after the update");
      assert.match(after, /RESIDENT_EDIT/);
      // The plugins re-run on the rebuild, so the banner is still applied once.
      TestUtilityPlugins.assertSingleBanner(after, "utility combo");
      // The edit replaced the original source, so its join call is gone.
      assert.doesNotMatch(after, /join\(/);
    } finally {
      service.dispose();
    }
  };
