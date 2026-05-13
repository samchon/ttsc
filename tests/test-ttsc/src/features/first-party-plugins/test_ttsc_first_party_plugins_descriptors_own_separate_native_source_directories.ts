import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestFirstPartyPlugins } from "../../internal/TestFirstPartyPlugins";

/**
 * Verifies ttsc first-party plugins: descriptors own separate native source
 * directories.
 *
 * This first-party plugin scenario stays in the compiler package because it
 * verifies shared host behavior across package boundaries.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads one or more first-party plugin
 *    descriptors.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_first_party_plugins_descriptors_own_separate_native_source_directories =
  () => {
    const expectations = {
      lint: "check",
      banner: "transform",
      paths: "transform",
      strip: "transform",
    };
    const seenDirs = new Set();
    for (const [name, stage] of Object.entries(expectations)) {
      const mod = TestProject.REQUIRE_FROM_TEST(
        path.join(TestProject.WORKSPACE_ROOT, "packages", name),
      );
      const factory = mod.createTtscPlugin ?? mod.default ?? mod;
      const descriptor = factory(TestFirstPartyPlugins.factoryContext(name));
      assert.equal(descriptor.name, `@ttsc/${name}`);
      assert.equal(descriptor.stage, stage);
      assert.deepEqual(Object.keys(descriptor).sort(), [
        "name",
        "source",
        "stage",
      ]);
      assert.equal(
        descriptor.source,
        path.join(TestProject.WORKSPACE_ROOT, "packages", name, "plugin"),
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
