import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project";

/**
 * Verifies readProjectConfig applies array extends in order.
 *
 * This ttsc project config scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_readprojectconfig_applies_array_extends_in_order = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
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
