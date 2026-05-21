import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: unsupported inline tsconfig keys are
 * rejected with a clear error message.
 *
 * Banner options must live exclusively in a `banner.config.*` file. Any key in
 * the tsconfig plugin entry that is not `configFile` (or a framework key like
 * `transform`) must produce a specific error naming the offending key. This
 * prevents silent no-ops where a user adds `text` or `config` inline expecting
 * a banner but receives none.
 *
 * 1. Create a project whose tsconfig plugin entry uses the formerly-accepted
 *    inline `text` key.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert non-zero exit and a stderr message naming the unsupported key.
 */
export const test_banner_keeps_legacy_named_user_options_as_plugin_config =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export const value = "x";\n`,
      },
      {
        compilerOptions: {
          plugins: [
            {
              transform: "@ttsc/banner",
              // "text" is no longer accepted inline — it must be in a config file.
              text: "phase",
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
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /unsupported key.*"text"|"text".*unsupported key/,
    );
  };
