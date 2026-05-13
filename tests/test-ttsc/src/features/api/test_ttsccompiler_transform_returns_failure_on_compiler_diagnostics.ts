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
 * Verifies TtscCompiler.transform returns failure on compiler diagnostics.
 *
 * This ttsc API scenario is owned by a tests package instead of the production
 * package manifest, so package.json stays focused on build and publish
 * contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_ttsccompiler_transform_returns_failure_on_compiler_diagnostics =
  () => {
    const root = createProject({
      source: 'const value: number = "not-a-number";\nconsole.log(value);\n',
    });
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      plugins: false,
    });

    const result = compiler.transform();

    assert.equal(result.type, "failure");
    assert.equal(expectArrayValue(result.diagnostics, 0).code, 2322);
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /not-a-number/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
