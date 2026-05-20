import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  loadProjectPlugins,
  os,
  path,
} from "../../internal/project";

/**
 * Verifies loadProjectPlugins resolves inherited relative transform paths from
 * the declaring file.
 *
 * When a parent tsconfig declares `plugins: [{transform:
 * "./plugins/base.cjs"}]` and a child tsconfig extends it, the
 * `./plugins/base.cjs` path must be resolved relative to the parent file — not
 * the child file — so the plugin CJS module is found at the correct location on
 * disk.
 *
 * 1. Create a `config/tsconfig.json` that declares a relative plugin path, and a
 *    `project/tsconfig.json` that extends it.
 * 2. Invoke `loadProjectPlugins` against the child tsconfig.
 * 3. Assert that loading throws `must declare source` (the plugin resolves to the
 *    right file, which has an empty `source`, rather than failing with a
 *    module-not-found error).
 */
export const test_loadprojectplugins_resolves_inherited_relative_transform_paths_from_the_declaring_file =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const shared = path.join(root, "config");
    const project = path.join(root, "project");
    fs.mkdirSync(path.join(shared, "plugins"), { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(
      path.join(shared, "plugins", "base.cjs"),
      `module.exports = { name: "base-relative", source: "" };\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(shared, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            plugins: [{ transform: "./plugins/base.cjs" }],
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify({ extends: "../config/tsconfig.json" }, null, 2),
      "utf8",
    );

    assert.throws(
      () =>
        loadProjectPlugins({
          binary: "",
          tsconfig: path.join(project, "tsconfig.json"),
        }),
      /must declare source/,
    );
  };
