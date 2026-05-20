import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project";

/**
 * Verifies readProjectConfig accepts JSONC comments and trailing commas.
 *
 * TypeScript's own `tsconfig.json` parser accepts JSONC (JSON with Comments and
 * trailing commas). `readProjectConfig` uses the same JSONC parser so that
 * plugin configuration embedded in tsconfig follows the same relaxed syntax
 * users already rely on for their compiler options.
 *
 * 1. Write a `tsconfig.json` that contains a `//` comment and a trailing comma in
 *    the plugins array.
 * 2. Invoke `readProjectConfig`.
 * 3. Assert the plugins array parses correctly to the expected single entry.
 */
export const test_readprojectconfig_accepts_jsonc_comments_and_trailing_commas =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      `{
      // plugin host configuration may live in JSONC tsconfig files
      "compilerOptions": {
        "plugins": [
          { "transform": "./plugins/jsonc.cjs" },
        ],
      },
    }\n`,
      "utf8",
    );

    const parsed = readProjectConfig({
      tsconfig: path.join(root, "tsconfig.json"),
    });
    assert.deepEqual(parsed.compilerOptions.plugins, [
      { transform: "./plugins/jsonc.cjs" },
    ]);
  };
