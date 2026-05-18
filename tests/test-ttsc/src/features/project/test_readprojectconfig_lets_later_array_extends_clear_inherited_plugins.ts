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
 * This ttsc project config scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
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
