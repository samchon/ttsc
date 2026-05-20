import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project";

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
