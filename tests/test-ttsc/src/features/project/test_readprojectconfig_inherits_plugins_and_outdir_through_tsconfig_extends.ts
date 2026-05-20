import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project";

/**
 * Verifies readProjectConfig inherits plugins and outDir through tsconfig
 * extends.
 *
 * When a child tsconfig extends a parent that declares `plugins` and `outDir`,
 * `readProjectConfig` must propagate both values to the resolved config and
 * record the parent directory in `pluginBaseDirs` so relative transform paths
 * are later resolved against the right base.
 *
 * 1. Create a shared `config/tsconfig.json` with `outDir` and one plugin entry.
 * 2. Write a project tsconfig that extends it with an empty `compilerOptions`.
 * 3. Assert the resolved config carries the inherited `plugins`, `outDir`
 *    (absolute), and `pluginBaseDirs` pointing at `config/`.
 */
export const test_readprojectconfig_inherits_plugins_and_outdir_through_tsconfig_extends =
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
            outDir: "../dist/shared",
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
          compilerOptions: {},
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
      { transform: "./plugins/example.cjs" },
    ]);
    assert.deepEqual(parsed.pluginBaseDirs, [shared]);
    assert.equal(parsed.compilerOptions.outDir, path.join(root, "dist/shared"));
  };
