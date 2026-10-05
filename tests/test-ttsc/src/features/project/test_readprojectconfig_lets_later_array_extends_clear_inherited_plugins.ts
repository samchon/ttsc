import { TestProject } from "../../../../utils/src/TestProject";
import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project-unit";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Asserts both plugins and pluginBaseDirs become empty after a later preset clears the array, detecting resurrection of inherited plugin entries or their base directory.
 * @evidence contracts/testing.md#independent-expectations The later preset explicitly declares an empty plugins array; ordered tsconfig replacement requires no plugin and no plugin resolution owner.
 * @evidence contracts/testing.md#distinguishing-cases Nonempty earlier and empty later entries contrast with applies_array_extends_in_order, whose later nonempty entry wins, and the omitted-child inheritance case.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on a project extending an array whose later entry declares an empty plugins list in a private temp directory; no install, native build, compiler process or CLI is involved.
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
