import { TestProject } from "../../../../utils/src/TestProject";

import { assert, fs, path, readProjectConfig } from "../../internal/project-unit";

/**
 * Verifies readProjectConfig accepts a UTF-8 BOM in an extended tsconfig.
 *
 * The parser is used for every file in an `extends` chain, not just the entry
 * tsconfig. A shared config saved with a BOM must therefore resolve inherited
 * compiler options without making each child project fail during config load.
 *
 * 1. Write a BOM-prefixed shared config that declares `rootDir`.
 * 2. Write a child config that extends it.
 * 3. Assert the inherited path option resolves from the shared config.
 *
 * @evidence contracts/testing.md#behavioral-verification Reads a child extending a BOM-prefixed preset and asserts the inherited rootDir, detecting parsing that accepts a BOM only at the entry file.
 * @evidence contracts/testing.md#independent-expectations The preset declares ../src relative to its shared directory; the expected sibling source directory follows the authored layout and tsconfig inheritance contract.
 * @evidence contracts/testing.md#distinguishing-cases The BOM occurs in the ancestor rather than the child; accepts_utf8_bom_at_tsconfig_start owns the root variant and names_the_extended_config_that_failed_to_parse owns a malformed ancestor.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on a child tsconfig extending a BOM-prefixed shared tsconfig in a private temp directory; no install, native build, compiler process or CLI is involved.
 */
export const test_readprojectconfig_accepts_utf8_bom_in_extended_tsconfig =
  () => {
    const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-project-"));
    const shared = path.join(root, "shared");
    const project = path.join(root, "project");
    fs.mkdirSync(shared, { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(
      path.join(shared, "tsconfig.json"),
      `\uFEFF{
        "compilerOptions": {
          "rootDir": "../src",
        },
      }\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify({ extends: "../shared/tsconfig.json" }, null, 2),
      "utf8",
    );

    const parsed = readProjectConfig({
      tsconfig: path.join(project, "tsconfig.json"),
    });

    assert.equal(parsed.compilerOptions.rootDir, path.join(root, "src"));
  };
