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
 * Verifies TtscCompiler.compile applies configured source plugins without
 * project output.
 *
 * `compile()` must run the plugin transform pipeline and return the emitted
 * JavaScript in its result map without ever writing files to disk. Pins the
 * in-memory output contract so bundler adapters and API callers can consume
 * plugin-transformed JS without side-effecting the project directory.
 *
 * 1. Create a project with a source plugin that upper-cases a string literal.
 * 2. Call `compile()` via the programmatic API.
 * 3. Assert the output map contains the transformed JS and `dist/` was not
 *    written.
 */
export const test_ttsccompiler_compile_applies_configured_source_plugins_without_project_output =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeCompilerPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.compile();

    assert.equal(result.type, "success");
    assert.match(expectRecordValue(result.output, "dist/main.js"), /PLUGIN/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
