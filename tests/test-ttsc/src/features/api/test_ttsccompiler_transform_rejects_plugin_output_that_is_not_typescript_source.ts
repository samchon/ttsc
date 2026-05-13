import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
  writeBrokenTransformPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform rejects plugin output that is not TypeScript
 * source.
 *
 * This ttsc API scenario is owned by a tests package instead of the production
 * package manifest, so package.json stays focused on build and publish
 * contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_ttsccompiler_transform_rejects_plugin_output_that_is_not_typescript_source =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeBrokenTransformPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "exception");
    assert.match(
      (result.error as Error).message,
      /did not return a TypeScript source map/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
