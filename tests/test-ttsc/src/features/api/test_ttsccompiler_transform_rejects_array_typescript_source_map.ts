import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeArrayTransformPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform rejects array-shaped TypeScript source maps.
 *
 * The `transformSource` hook contract requires each plugin to return a
 * `Record<string, string>` keyed by file path. A plugin that returns an array
 * instead bypasses the object check and would silently produce a corrupt source
 * map. Pins the validation that detects and rejects the wrong shape with a
 * clear error rather than writing undefined into the output.
 *
 * 1. Create a project with a plugin whose `transformSource` returns an array.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the result is `exception` and the error mentions the source map shape.
 */
export const test_ttsccompiler_transform_rejects_array_typescript_source_map =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeArrayTransformPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "exception");
    assert.match(
      (result.error as Error).message,
      /did not return a TypeScript source map/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
