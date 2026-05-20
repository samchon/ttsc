import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project";

/**
 * Verifies readProjectConfig lets later array extends clear inherited plugins.
 *
 * When a tsconfig uses the `extends` array and a later entry sets `plugins:
 * []`, the empty array must replace the earlier entry's plugins rather than
 * being ignored. Without this, `plugins: []` would be a no-op and there would
 * be no way to opt out of plugins introduced by an earlier base config.
 *
 * 1. Create `base-a.json` with one plugin entry and `base-b.json` with `plugins:
 *    []`.
 * 2. Write a project tsconfig that extends `[base-a, base-b]`.
 * 3. Assert the resolved plugins array is empty and `pluginBaseDirs` is empty.
 */
export const test_readprojectconfig_lets_later_array_extends_clear_inherited_plugins =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const shared = path.join(root, "config");
    const project = path.join(root, "project");
    fs.mkdirSync(shared, { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(
      path.join(shared, "base-a.json"),
      JSON.stringify(
        {
          compilerOptions: {
            plugins: [{ transform: "./plugins/base-a.cjs" }],
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(shared, "base-b.json"),
      JSON.stringify(
        {
          compilerOptions: {
            plugins: [],
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
          extends: ["../config/base-a.json", "../config/base-b.json"],
        },
        null,
        2,
      ),
      "utf8",
    );

    const parsed = readProjectConfig({
      tsconfig: path.join(project, "tsconfig.json"),
    });

    assert.deepEqual(parsed.compilerOptions.plugins, []);
    assert.deepEqual(parsed.pluginBaseDirs, []);
  };
