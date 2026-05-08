import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProject, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: shared transform host works when paths is first.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_shared_transform_host_works_when_paths_is_first =
  () => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          declaration: true,
          strict: true,
          paths: {
            "@lib/*": ["./src/modules/*"],
          },
          outDir: "dist",
          rootDir: "src",
          plugins: [
            { transform: "@ttsc/paths" },
            { transform: "@ttsc/banner", text: "paths first" },
            {
              transform: "@ttsc/strip",
              calls: ["console.log"],
              statements: ["debugger"],
            },
          ],
        },
        include: ["src"],
      }),
      "src/modules/message.ts": `export const message = "ok";\n`,
      "src/main.ts": [
        `import { message } from "@lib/message";`,
        `console.log("drop");`,
        `debugger;`,
        `export const value = message;`,
        ``,
      ].join("\n"),
    });
    TestTtscUtilityPlugins.seedUtilityPackages(root, [
      "banner",
      "paths",
      "strip",
    ]);
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: TestTtscUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-utility-paths-first-"),
        ),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
    TestTtscUtilityPlugins.assertSingleBanner(js, "paths first");
    TestTtscUtilityPlugins.assertSingleBanner(dts, "paths first");
    assert.match(js, /require\("\.\/modules\/message\.js"\)/);
    assert.doesNotMatch(js, /@lib\/message|console\.log|\bdebugger\b/);
  };
