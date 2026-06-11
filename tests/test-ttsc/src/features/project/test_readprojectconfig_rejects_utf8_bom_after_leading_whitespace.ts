import { TestProject } from "@ttsc/testing";

import { assert, fs, path, readProjectConfig } from "../../internal/project";

/**
 * Verifies readProjectConfig only strips a BOM at the start of the file.
 *
 * A UTF-8 BOM is valid as the first decoded code point. Stripping it from any
 * later position would hide malformed config content, so this negative twin
 * keeps invalid whitespace-before-BOM input rejected.
 *
 * 1. Write a `tsconfig.json` whose BOM appears after a leading space.
 * 2. Invoke `readProjectConfig`.
 * 3. Assert the config still throws a JSON parse error.
 */
export const test_readprojectconfig_rejects_utf8_bom_after_leading_whitespace =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      ` \uFEFF${JSON.stringify({ compilerOptions: { strict: true } })}`,
      "utf8",
    );

    assert.throws(
      () => readProjectConfig({ tsconfig: path.join(root, "tsconfig.json") }),
      /Unexpected token/,
    );
  };
