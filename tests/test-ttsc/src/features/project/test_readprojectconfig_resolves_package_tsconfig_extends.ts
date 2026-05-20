import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project";

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
 */
export const test_readprojectconfig_resolves_package_tsconfig_extends = () => {
  const root = TestProject.tmpdir("ttsc-project-");
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
