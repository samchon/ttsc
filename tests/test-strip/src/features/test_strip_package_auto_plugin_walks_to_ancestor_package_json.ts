import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../internal/TestStrip";

/**
 * Verifies the @ttsc/strip plugin: package ttsc.plugin walks to ancestor
 * package.json.
 *
 * This strip feature is isolated as one exported TypeScript test so failures
 * identify the exact package contract without a shared smoke wrapper.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads @ttsc/strip from package or tsconfig
 *    plugin options.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_strip_package_auto_plugin_walks_to_ancestor_package_json =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        dependencies: { "@ttsc/strip": "*" },
      }),
      "packages/app/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "packages/app/src/main.ts": [
        `console.log("drop-log");`,
        `debugger;`,
        `export const value = "kept";`,
        ``,
      ].join("\n"),
    });
    TestStrip.seedPackage(root);

    const project = path.join(root, "packages", "app");
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", project, "--emit"],
      {
        cwd: project,
        env: {
          PATH: TestStrip.goPath(),
          TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-ancestor-strip-"),
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(project, "dist", "main.js"), "utf8");
    assert.match(js, /kept/);
    assert.doesNotMatch(js, /console\.log|\bdebugger\b/);
  };
