import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project-unit";

/**
 * Verifies readProjectConfig lets child tsconfig override inherited plugins.
 *
 * A child tsconfig's own `compilerOptions.plugins` array must completely
 * replace the parent's plugins — not merge with them. This mirrors standard
 * tsconfig inheritance behaviour: the child's explicit value wins, so a project
 * can opt out of shared plugins by providing its own list.
 *
 * 1. Create a shared config that declares one plugin entry.
 * 2. Write a project tsconfig that extends it and provides its own `plugins` array
 *    with a different entry.
 * 3. Assert the resolved plugins contain only the child's entry.
 *
 * @evidence contracts/testing.md#behavioral-verification Compares the complete child plugin array after inheritance, detecting merging with a parent plugin that the child replaces.
 * @evidence contracts/testing.md#independent-expectations The child explicitly supplies local-plugin while the parent supplies example; tsconfig option replacement requires the expected single child entry.
 * @evidence contracts/testing.md#distinguishing-cases Distinct parent and child arrays distinguish replacement from merging; inherits_plugins_and_outdir_through_tsconfig_extends owns omission and lets_later_array_extends_clear_inherited_plugins owns empty replacement.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the exported test_readprojectconfig_lets_child_tsconfig_override_inherited_plugins once under src/unit/project. It calls the authored readProjectConfig on an isolated fixture directory; there is no installation, native build or CLI process.
 */
export const test_readprojectconfig_lets_child_tsconfig_override_inherited_plugins =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const shared = path.join(root, "config");
    const project = path.join(root, "project");
    fs.mkdirSync(shared, { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(
      path.join(shared, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            plugins: [{ transform: "./plugins/example.cjs" }],
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify(
        {
          extends: "../config/tsconfig.json",
          compilerOptions: {
            plugins: [{ transform: "./local-plugin.cjs" }],
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const parsed = readProjectConfig({
      tsconfig: path.join(project, "tsconfig.json"),
    });
    assert.deepEqual(parsed.compilerOptions.plugins, [
      { transform: "./local-plugin.cjs" },
    ]);
  };
