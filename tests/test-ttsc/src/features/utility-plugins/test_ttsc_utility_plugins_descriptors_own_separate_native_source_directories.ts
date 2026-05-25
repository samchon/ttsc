import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";

/**
 * Verifies ttsc utility plugins: descriptors own separate native source
 * directories.
 *
 * Each utility package (`lint`, `banner`, `paths`, `strip`) must advertise its
 * own `source` directory — distinct from every other package — so the
 * linked-plugin host can combine their sources into one binary without path
 * collisions. The `stage`, optional diagnostics capability, and `package.json`
 * plugin field must also match the expected values for each package.
 *
 * 1. Invoke `createTtscPlugin` for each utility package with a factory context.
 * 2. Assert the returned descriptor's `name`, `source`, and `stage` fields.
 * 3. Assert all four `source` directories are distinct.
 */
export const test_ttsc_utility_plugins_descriptors_own_separate_native_source_directories =
  () => {
    const expectations: Record<
      string,
      {
        source: string;
        stage: string;
        capabilities?: {
          diagnosticsTiming?: boolean;
          lsp?: boolean;
          threadingArgs?: boolean;
        };
        reportsTypeScriptDiagnostics?: boolean;
      }
    > = {
      lint: {
        capabilities: {
          diagnosticsTiming: true,
          lsp: true,
          threadingArgs: true,
        },
        reportsTypeScriptDiagnostics: true,
        source: "plugin",
        stage: "check",
      },
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
        ...(expectation.capabilities !== undefined ? ["capabilities"] : []),
        "name",
        ...(expectation.reportsTypeScriptDiagnostics !== undefined
          ? ["reportsTypeScriptDiagnostics"]
          : []),
        "source",
        "stage",
      ]);
      if (expectation.capabilities !== undefined) {
        assert.deepEqual(descriptor.capabilities, expectation.capabilities);
      }
      if (expectation.reportsTypeScriptDiagnostics !== undefined) {
        assert.equal(
          descriptor.reportsTypeScriptDiagnostics,
          expectation.reportsTypeScriptDiagnostics,
        );
      }
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
