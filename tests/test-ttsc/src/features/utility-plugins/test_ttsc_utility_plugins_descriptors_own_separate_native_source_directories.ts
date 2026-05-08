import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { requireFromTest, workspaceRoot } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: descriptors own separate native source directories.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_descriptors_own_separate_native_source_directories =
  () => {
    const expectations = {
      lint: "check",
      banner: "transform",
      paths: "transform",
      strip: "transform",
    };
    const seenDirs = new Set();
    for (const [name, stage] of Object.entries(expectations)) {
      const mod = requireFromTest(path.join(workspaceRoot, "packages", name));
      const factory = mod.createTtscPlugin ?? mod.default ?? mod;
      const descriptor = factory(TestTtscUtilityPlugins.factoryContext(name));
      assert.equal(descriptor.name, `@ttsc/${name}`);
      assert.equal(descriptor.stage, stage);
      assert.deepEqual(Object.keys(descriptor).sort(), [
        "name",
        "source",
        "stage",
      ]);
      assert.equal(
        descriptor.source,
        path.join(workspaceRoot, "packages", name, "plugin"),
      );
      assert.equal(
        fs.existsSync(path.join(workspaceRoot, "packages", name, "go.mod")),
        true,
      );
      const manifest = JSON.parse(
        fs.readFileSync(
          path.join(workspaceRoot, "packages", name, "package.json"),
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
