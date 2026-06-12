import { TestProject } from "@ttsc/testing";

import { assert, fs, path, readProjectConfig } from "../../internal/project";

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
 */
export const test_readprojectconfig_accepts_utf8_bom_in_extended_tsconfig =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
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
