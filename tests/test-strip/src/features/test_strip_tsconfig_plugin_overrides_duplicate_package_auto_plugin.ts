import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestStrip } from "../internal/TestStrip";

/**
 * Verifies the @ttsc/strip plugin: tsconfig plugin wins over duplicate package
 * auto plugin.
 *
 * This strip feature is isolated as one exported TypeScript test so failures
 * identify the exact package contract without a shared smoke wrapper.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads @ttsc/strip from package or tsconfig
 *    plugin options.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_strip_tsconfig_plugin_overrides_duplicate_package_auto_plugin =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": [
          `console.log("keep-log");`,
          `console.warn("drop-warn");`,
          `export const value = "explicit";`,
          ``,
        ].join("\n"),
      },
      {
        compilerOptions: {
          plugins: [{ transform: "@ttsc/strip", calls: ["console.warn"] }],
        },
      },
    );
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { "@ttsc/strip": "*" } }),
    );
    TestStrip.seedPackage(root);

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestStrip.goPath(),
          TTSC_CACHE_DIR: fs.mkdtempSync(
            path.join(os.tmpdir(), "ttsc-auto-strip-explicit-"),
          ),
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /console\.log\("keep-log"\)/);
    assert.doesNotMatch(js, /console\.warn/);
  };
