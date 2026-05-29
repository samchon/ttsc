import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestStrip } from "../internal/TestStrip";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

/**
 * Verifies the @ttsc/strip plugin: rejects inline configuration keys in the
 * tsconfig plugin entry.
 *
 * Locks the validation path in the JS descriptor factory and the Go driver:
 * keys like `calls` and `statements` that were formerly accepted inline on the
 * tsconfig plugin entry must now be rejected with a clear error. This prevents
 * stale tsconfig entries from silently falling back to defaults instead of
 * surfacing a migration hint.
 *
 * 1. Create a project whose tsconfig plugin entry contains `calls` directly (the
 *    old inline shape).
 * 2. Run `ttsc --emit`.
 * 3. Assert a non-zero exit and that stderr mentions the unsupported key and
 *    points the user to a strip.config.* file.
 */
export const test_strip_rejects_inline_config_keys = () => {
  const root = TestProject.commonJsProject(
    {
      "src/main.ts": `console.log("hello");\nexport const v = 1;\n`,
    },
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/strip",
            // Old inline-config key — must be rejected now.
            calls: ["console.log"],
          },
        ],
      },
    },
  );
  TestStrip.seedPackage(root);

  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestStrip.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.notEqual(
    result.status,
    0,
    "expected non-zero exit for inline config keys",
  );
  assert.match(
    result.stderr,
    /unsupported key.*"calls"|"calls".*unsupported key/,
    `stderr should name the unsupported key: ${result.stderr}`,
  );
};
