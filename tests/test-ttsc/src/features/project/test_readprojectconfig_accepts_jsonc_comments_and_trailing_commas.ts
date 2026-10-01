import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project-unit";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Reads an authored JSONC config and compares the complete plugin entry, detecting a comment or trailing comma that wrongly prevents configuration loading.
 * @evidence contracts/testing.md#independent-expectations The literal plugin descriptor is authored in the fixture; JSONC comments and trailing commas have the same value semantics as the corresponding ordinary JSON object.
 * @evidence contracts/testing.md#distinguishing-cases A line comment and trailing commas occur together in the successful fixture; names_the_config_that_failed_to_parse owns the adjacent unterminated-object rejection.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on a tsconfig.json containing a line comment and trailing commas in a private temp directory; no install, native build, compiler process or CLI is involved.
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
