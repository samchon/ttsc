import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../internal/TestStrip";

/**
 * Verifies the @ttsc/strip plugin: honors an explicit configFile path from the
 * tsconfig plugin entry.
 *
 * Locks the configFile resolution path in loadStripConfigMap: when the tsconfig
 * plugin entry contains a "configFile" key, the driver must resolve the path
 * relative to the tsconfig directory and load configuration from that file
 * instead of running auto-discovery.
 *
 * 1. Create a project with a custom config file at a non-default path
 *    (`config/my-strip.json`) and a tsconfig plugin entry that references it
 *    via `configFile`.
 * 2. Run `ttsc --emit`.
 * 3. Assert that only the calls listed in the custom file are stripped and that
 *    the default strip targets (console.log, console.debug) are not stripped.
 */
export const test_strip_uses_explicit_config_file_path = () => {
  const root = TestProject.commonJsProject(
    {
      "src/main.ts": [
        `console.warn("drop-warn");`,
        `console.log("keep-log");`,
        `export const value = "ok";`,
        ``,
      ].join("\n"),
      "config/my-strip.json": JSON.stringify({
        calls: ["console.warn"],
        statements: [],
      }),
    },
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/strip",
            configFile: "config/my-strip.json",
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
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-strip-configfile-"),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.doesNotMatch(js, /console\.warn/);
  assert.match(js, /console\.log\("keep-log"\)/);
};
