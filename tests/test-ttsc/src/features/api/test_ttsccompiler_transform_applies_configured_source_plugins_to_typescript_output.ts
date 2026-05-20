import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
  writeCompilerPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform applies configured source plugins to
 * TypeScript output.
 *
 * `transform()` runs the plugin pipeline and returns transformed TypeScript
 * source (not emitted JS). Pins the source-to-source path so bundler adapters
 * that need to feed plugin-transformed TS back to their own compiler receive
 * the `.ts` content and not any `.js` or `.d.ts` artifacts.
 *
 * 1. Create a project with a plugin that replaces a function call with an
 *    upper-cased string.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the result map contains the transformed TS source and no JS output
 *    keys.
 */
export const test_ttsccompiler_transform_applies_configured_source_plugins_to_typescript_output =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeCompilerPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /export const value = "PLUGIN"/,
    );
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /console\.log\(value\)/,
    );
    assert.equal(result.typescript["dist/main.js"], undefined);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
