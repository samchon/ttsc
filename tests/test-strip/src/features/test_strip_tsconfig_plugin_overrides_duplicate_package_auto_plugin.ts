import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../internal/TestStrip";

/**
 * Verifies the @ttsc/strip plugin: tsconfig plugin wins over duplicate package
 * auto plugin.
 *
 * When `@ttsc/strip` is present in both a tsconfig plugin entry and in
 * `package.json` dependencies, the loader must deduplicate and use only the
 * tsconfig entry's config. Without deduplication the plugin would run twice —
 * once with the explicit config and once with the default config — which could
 * strip calls the user explicitly chose to keep.
 *
 * 1. Create a project whose tsconfig configures the plugin to strip only
 *    `console.warn`, while `package.json` also lists `@ttsc/strip` (default
 *    config would additionally strip `console.log`).
 * 2. Run `ttsc --emit`.
 * 3. Assert `console.log("keep-log")` is present in the output and `console.warn`
 *    is absent — confirming only the tsconfig config ran.
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
          TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-auto-strip-explicit-"),
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /console\.log\("keep-log"\)/);
    assert.doesNotMatch(js, /console\.warn/);
  };
