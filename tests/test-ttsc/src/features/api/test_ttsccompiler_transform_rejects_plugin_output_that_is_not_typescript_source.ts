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
 * A `transformSource` hook that returns non-string values (e.g. numbers or
 * objects) for file content would silently corrupt the source map. Pins the
 * guard that detects when any value in the returned map is not a plain string
 * and throws a descriptive exception rather than forwarding garbage to the
 * compiler pipeline.
 *
 * 1. Create a project with a plugin whose `transformSource` returns non-string
 *    values.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the result is `exception` and the error mentions the source map shape.
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
