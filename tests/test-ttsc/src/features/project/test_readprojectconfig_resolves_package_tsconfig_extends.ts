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
 * This ttsc project config scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
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
