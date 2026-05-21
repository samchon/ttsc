import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: inline options in the tsconfig plugin entry
 * are rejected with a specific error.
 *
 * All banner options must live in a dedicated `banner.config.*` file. The only
 * accepted key in the tsconfig plugin entry is `configFile` (plus framework
 * keys like `transform`). Providing any other key — such as the
 * formerly-accepted `text` or `config` — must fail immediately with an error
 * that names the offending key and points users at the config file. This
 * prevents silent no-ops where a user writes `{ "transform": "@ttsc/banner",
 * "text": "…" }` and receives no banner instead of the expected output.
 *
 * 1. Create projects with each of the formerly-accepted inline keys (`text`,
 *    `config`) and an unrecognised key (`options`).
 * 2. Run `ttsc --emit` against each project.
 * 3. Assert non-zero exit and a stderr message that names the offending key and
 *    mentions `configFile`.
 */
export const test_banner_rejects_inline_options_in_tsconfig_entry = () => {
  for (const [key, value] of [
    ["text", "my banner"],
    ["config", "./banner.config.cjs"],
    ["options", { text: "x" }],
  ] as const) {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export const value = "x";\n`,
      },
      {
        compilerOptions: {
          plugins: [
            {
              transform: "@ttsc/banner",
              [key]: value,
            },
          ],
        },
      },
    );
    TestBanner.seedPackage(root);
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      { cwd: root },
    );
    assert.notEqual(result.status, 0, `expected failure for key "${key}"`);
    assert.match(
      result.stderr,
      new RegExp(`unsupported key.*"${key}"|"${key}".*unsupported key`),
      `stderr should name unsupported key "${key}"`,
    );
    assert.match(
      result.stderr,
      /configFile/,
      `stderr should mention configFile for key "${key}"`,
    );
  }
};
