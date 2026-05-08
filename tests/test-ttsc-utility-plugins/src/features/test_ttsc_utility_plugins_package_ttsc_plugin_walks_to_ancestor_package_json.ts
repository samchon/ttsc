import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProject, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: package ttsc.plugin walks to ancestor package.json.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_package_ttsc_plugin_walks_to_ancestor_package_json =
  () => {
    const root = createProject({
      "package.json": JSON.stringify({
        dependencies: { "@ttsc/strip": "0.8.1" },
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
    TestTtscUtilityPlugins.seedUtilityPackages(root, ["strip"]);

    const project = path.join(root, "packages", "app");
    const result = spawn(ttscBin, ["--cwd", project, "--emit"], {
      cwd: project,
      env: {
        PATH: TestTtscUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-ancestor-strip-"),
        ),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(project, "dist", "main.js"), "utf8");
    assert.match(js, /kept/);
    assert.doesNotMatch(js, /console\.log|\bdebugger\b/);
  };
