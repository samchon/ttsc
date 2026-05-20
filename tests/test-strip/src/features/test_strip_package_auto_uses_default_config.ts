import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../internal/TestStrip";

/**
 * Verifies the @ttsc/strip plugin: package ttsc.plugin auto-discovers strip
 * defaults.
 *
 * When `@ttsc/strip` appears in `package.json` dependencies without a matching
 * tsconfig plugin entry, the plugin is auto-registered with its built-in
 * default config (`console.log`, `console.debug`, `assert.*`, and `debugger`).
 * This pins the default stripping contract so changes to the default list break
 * here rather than silently passing through to the user's build.
 *
 * 1. Create a CommonJS project whose source uses all four default strip targets
 *    plus a `kept` export, with `package.json` listing `@ttsc/strip`.
 * 2. Run `ttsc --emit` without any tsconfig plugin configuration.
 * 3. Assert the emitted `.js` contains `kept` and none of the stripped calls or
 *    `debugger`.
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
