import { TestProject } from "../../../../utils/src/TestProject";
import {
  assert,
  fs,
  path,
  readProjectConfig,
} from "../../internal/project-unit";

/**
 * Verifies readProjectConfig accepts a UTF-8 BOM at the start of tsconfig.
 *
 * TypeScript accepts UTF-8 BOM-prefixed config files. `readProjectConfig` must
 * accept that marker as JSONC whitespace while parsing comments and trailing
 * commas so ttsc does not reject projects that the native compiler accepts.
 *
 * 1. Write a BOM-prefixed `tsconfig.json` that also uses JSONC syntax.
 * 2. Invoke `readProjectConfig`.
 * 3. Assert the compiler options parse normally.
 *
 * @evidence contracts/testing.md#behavioral-verification Checks both resolved baseUrl and plugin entries from a BOM-prefixed JSONC root, detecting incorrect BOM rejection while preserving option values.
 * @evidence contracts/testing.md#independent-expectations The fixture specifies baseUrl dot and a literal plugin path; the expected physical root follows path resolution of that authored directory.
 * @evidence contracts/testing.md#distinguishing-cases A BOM combines with comments and trailing commas at the entry config; accepts_utf8_bom_in_extended_tsconfig owns the ancestor variant and names_the_config_that_failed_to_parse owns malformed input.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on a BOM-prefixed JSONC tsconfig.json in a private temp directory; no install, native build, compiler process or CLI is involved.
 */
export const test_readprojectconfig_accepts_utf8_bom_at_tsconfig_start = () => {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-project-"));
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
