import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform returns TypeScript source without project
 * files.
 *
 * This ttsc API scenario is owned by a tests package instead of the production
 * package manifest, so package.json stays focused on build and publish
 * contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_ttsccompiler_transform_returns_typescript_source_without_project_files =
  () => {
    const root = createProject();
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      plugins: false,
    });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /const message: string = "api-ok"/,
    );
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /console\.log\(\s*message\s*\)/,
    );
    assert.equal(result.typescript["dist/main.js"], undefined);
    assert.equal(result.typescript["dist/main.d.ts"], undefined);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
