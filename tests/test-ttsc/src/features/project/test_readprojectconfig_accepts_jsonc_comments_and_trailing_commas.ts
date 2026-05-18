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
 * This ttsc project config scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
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
