import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscService } from "../../../../../packages/ttsc/lib/index.js";
import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { tsgo } from "../../internal/compiler";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies a resident service resolves links at any path component.
 *
 * Remapping only the caller's logical project root leaves a link inside the
 * project in the request key. The resident Program names the target's physical
 * file, so both transform and update miss it; a link to a file outside the
 * Program must still return `undefined`.
 *
 * 1. Link an in-project directory to the Program's source directory.
 * 2. Transform and update a source through that nested link.
 * 3. Assert an external target reached through another link stays absent.
 */
export const test_ttscservice_resolves_a_file_through_a_nested_directory_link =
  async (): Promise<void> => {
    const root = TestProject.copyProject("ttsc-utility-plugins");
    TestUtilityPlugins.seedPackages(root);
    const alias = path.join(root, "linked-src");
    fs.symlinkSync(path.join(root, "src"), alias, "junction");
    const outside = TestProject.tmpdir("ttsc-service-outside-");
    fs.writeFileSync(
      path.join(outside, "absent.ts"),
      "export const absent = true;\n",
      "utf8",
    );
    const externalAlias = path.join(root, "external-src");
    fs.symlinkSync(outside, externalAlias, "junction");

    const service = new TtscService({
      binary: tsgo,
      cwd: root,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    try {
      const file = path.join(alias, "main.ts");
      const before = await service.transformFile(file);
      assert.ok(before, "the linked source was absent from the resident host");
      TestUtilityPlugins.assertSingleBanner(before, "utility combo");

      assert.equal(
        await service.updateFile(
          file,
          'export const marker: string = "NESTED_LINK_EDIT";\n',
        ),
        true,
      );
      assert.match(
        (await service.transformFile(file)) ?? "",
        /NESTED_LINK_EDIT/,
      );
      assert.equal(
        await service.transformFile(path.join(externalAlias, "absent.ts")),
        undefined,
      );
    } finally {
      service.dispose();
    }
  };
