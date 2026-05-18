import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../internal/TestStrip";

/**
 * Verifies the @ttsc/strip plugin: package ttsc.plugin auto-discovers strip
 * defaults.
 *
 * This strip feature is isolated as one exported TypeScript test so failures
 * identify the exact package contract without a shared smoke wrapper.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads @ttsc/strip from package or tsconfig
 *    plugin options.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_strip_package_auto_uses_default_config = () => {
  const root = TestProject.commonJsProject({
    "src/main.ts": [
      `declare const assert: { equal(left: unknown, right: unknown): void };`,
      `console.log("drop-log");`,
      `console.debug("drop-debug");`,
      `assert.equal("drop", "assert");`,
      `debugger;`,
      `export const value = "kept";`,
      ``,
    ].join("\n"),
  });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ dependencies: { "@ttsc/strip": "*" } }),
  );
  TestStrip.seedPackage(root);

  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestStrip.goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-auto-strip-"),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /kept/);
  assert.doesNotMatch(js, /console\.(?:log|debug)|assert\.equal|\bdebugger\b/);
};
