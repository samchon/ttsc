import { TestProject } from "@ttsc/testing";

import { assert, fs, path, readProjectConfig } from "../../internal/project";

/**
 * Verifies readProjectConfig accepts a UTF-8 BOM at the start of tsconfig.
 *
 * TypeScript accepts UTF-8 BOM-prefixed config files. `readProjectConfig` must
 * do the same before applying its JSONC comment/trailing-comma parser so ttsc
 * does not reject projects that the native compiler accepts.
 *
 * 1. Write a BOM-prefixed `tsconfig.json` that also uses JSONC syntax.
 * 2. Invoke `readProjectConfig`.
 * 3. Assert the compiler options parse normally.
 */
export const test_readprojectconfig_accepts_utf8_bom_at_tsconfig_start = () => {
  const root = TestProject.tmpdir("ttsc-project-");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    `\uFEFF{
      // BOM-prefixed JSONC should parse like TypeScript's config reader.
      "compilerOptions": {
        "baseUrl": ".",
        "plugins": [
          { "transform": "./plugins/bom.cjs" },
        ],
      },
    }\n`,
    "utf8",
  );

  const parsed = readProjectConfig({
    tsconfig: path.join(root, "tsconfig.json"),
  });

  assert.equal(parsed.compilerOptions.baseUrl, root);
  assert.deepEqual(parsed.compilerOptions.plugins, [
    { transform: "./plugins/bom.cjs" },
  ]);
};
