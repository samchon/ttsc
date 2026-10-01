import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project-unit";

/**
 * Verifies readProjectConfig applies array extends in order.
 *
 * TypeScript 5.0 supports an `extends` array where later entries override
 * earlier ones. `readProjectConfig` must honour the same left-to-right
 * precedence: scalar options like `outDir` take the last non-null value, and
 * plugins take the value from the last entry that defines them.
 *
 * 1. Create `base-a.json` (outDir, rootDir, plugins-a) and `base-b.json` (outDir
 *    override, plugins-b) under a shared config directory.
 * 2. Write a project tsconfig with `extends: ["base-a.json", "base-b.json"]` and
 *    its own `declarationDir`.
 * 3. Assert `outDir` comes from `base-b`, `rootDir` from `base-a`, `plugins` from
 *    `base-b`, and `pluginBaseDirs` lists only the `shared` directory.
 *
 * @evidence contracts/testing.md#behavioral-verification Compares outDir, rootDir, declarationDir, plugins and pluginBaseDirs after ordered array inheritance, detecting reversed precedence or an incorrect declaring directory.
 * @evidence contracts/testing.md#independent-expectations The second preset explicitly overrides output and plugins while omitting the first preset rootDir; the child declarationDir is independently authored.
 * @evidence contracts/testing.md#distinguishing-cases Overridden options, inherited omitted options and child-only options are distinguished in one array; lets_later_array_extends_clear_inherited_plugins owns the explicit empty-list boundary.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on a project tsconfig that extends two base configs through an array in a private temp directory; no install, native build, compiler process or CLI is involved.
 */
export const test_readprojectconfig_applies_array_extends_in_order = () => {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-project-"));
  const shared = path.join(root, "config");
  const project = path.join(root, "project");
  fs.mkdirSync(shared, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(shared, "base-a.json"),
    JSON.stringify(
      {
        compilerOptions: {
          outDir: "../dist/base-a",
          rootDir: "../src-a",
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
          outDir: "../dist/base-b",
          plugins: [{ transform: "./plugins/base-b.cjs" }],
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
        compilerOptions: {
          declarationDir: "../types",
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

  assert.equal(parsed.compilerOptions.outDir, path.join(root, "dist/base-b"));
  assert.equal(parsed.compilerOptions.rootDir, path.join(root, "src-a"));
  assert.equal(parsed.compilerOptions.declarationDir, path.join(root, "types"));
  assert.deepEqual(parsed.compilerOptions.plugins, [
    { transform: "./plugins/base-b.cjs" },
  ]);
  assert.deepEqual(parsed.pluginBaseDirs, [shared]);
};
