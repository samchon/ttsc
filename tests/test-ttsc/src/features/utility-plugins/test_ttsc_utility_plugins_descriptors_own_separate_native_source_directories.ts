import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";

/**
 * Verifies ttsc utility plugins: descriptors own separate native source
 * directories.
 *
 * This scenario stays in the compiler package because it verifies descriptor
 * source ownership across package boundaries.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads utility plugin descriptors.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_descriptors_own_separate_native_source_directories =
  () => {
    const expectations = {
      lint: { source: "plugin", stage: "check" },
      banner: { source: "driver", stage: "transform" },
      paths: { source: "driver", stage: "transform" },
      strip: { source: "driver", stage: "transform" },
    };
    const seenDirs = new Set();
    for (const [name, expectation] of Object.entries(expectations)) {
      const mod = TestProject.REQUIRE_FROM_TEST(
        path.join(TestProject.WORKSPACE_ROOT, "packages", name),
      );
      const factory = mod.createTtscPlugin ?? mod.default ?? mod;
      const descriptor = factory(TestUtilityPlugins.factoryContext(name));
      assert.equal(descriptor.name, `@ttsc/${name}`);
      assert.equal(descriptor.stage, expectation.stage);
      assert.deepEqual(Object.keys(descriptor).sort(), [
        "name",
        "source",
        "stage",
      ]);
      assert.equal(
        descriptor.source,
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages",
          name,
          expectation.source,
        ),
      );
      assert.equal(
        fs.existsSync(
          path.join(TestProject.WORKSPACE_ROOT, "packages", name, "go.mod"),
        ),
        true,
      );
      const manifest = JSON.parse(
        fs.readFileSync(
          path.join(
            TestProject.WORKSPACE_ROOT,
            "packages",
            name,
            "package.json",
          ),
          "utf8",
        ),
      );
      assert.deepEqual(manifest.ttsc?.plugin, {
        transform: `@ttsc/${name}`,
      });
      seenDirs.add(descriptor.source);
    }
    assert.equal(seenDirs.size, 4);
  };
