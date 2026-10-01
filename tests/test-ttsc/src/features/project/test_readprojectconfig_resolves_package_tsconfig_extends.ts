import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project-unit";

/**
 * Verifies readProjectConfig resolves package tsconfig extends.
 *
 * `extends` can reference a bare package specifier like
 * `"@scope/tsconfig/base.json"`. `readProjectConfig` must resolve this via
 * `require.resolve` (or equivalent node_modules lookup) so shared tsconfig
 * presets work the same way they do in the TypeScript compiler.
 *
 * 1. Create a fake `node_modules/@scope/tsconfig/base.json` with an `outDir` and a
 *    plugins entry.
 * 2. Write a project tsconfig that extends `"@scope/tsconfig/base.json"`.
 * 3. Assert the resolved plugins and `outDir` (absolute) match the preset's
 *    values, anchored at the preset's location in node_modules.
 *
 * @evidence contracts/testing.md#behavioral-verification Reads a scoped package preset subpath and checks inherited plugins and absolute output location, detecting failure to resolve node_modules presets or incorrect path ownership.
 * @evidence contracts/testing.md#independent-expectations The authored scoped package base.json supplies the literal plugin and ../../dist/preset output; expected anchoring follows that preset directory.
 * @evidence contracts/testing.md#distinguishing-cases One positive case: a scoped package subpath (@scope/tsconfig/base.json) resolved through node_modules; the bare manifest-selected package, the missing target and the malformed manifest are other tests' cases.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on a project extending @scope/tsconfig/base.json from a fake node_modules directory in a private temp directory; no install, native build, compiler process or CLI is involved.
 */
export const test_readprojectconfig_resolves_package_tsconfig_extends = () => {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-project-"));
  const preset = path.join(root, "node_modules", "@scope", "tsconfig");
  const project = path.join(root, "project");
  fs.mkdirSync(preset, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(preset, "base.json"),
    JSON.stringify(
      {
        compilerOptions: {
          outDir: "../../dist/preset",
          plugins: [{ transform: "./plugins/from-preset.cjs" }],
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
        extends: "@scope/tsconfig/base.json",
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
    { transform: "./plugins/from-preset.cjs" },
  ]);
  assert.equal(
    parsed.compilerOptions.outDir,
    path.join(root, "node_modules", "dist", "preset"),
  );
};
