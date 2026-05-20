import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
  writePackageCompilerPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.compile applies package-discovered source plugins.
 *
 * Plugins declared via `ttsc.plugins` in `package.json` rather than in
 * `tsconfig.json` must be discovered and applied during `compile()`. Pins the
 * package-based auto-discovery path so projects that co-locate plugin config
 * with their package manifest (rather than tsconfig) get equivalent transform
 * behavior through the programmatic API.
 *
 * 1. Create a project with a plugin declared in `package.json` only.
 * 2. Call `compile()` via the programmatic API.
 * 3. Assert the output map contains the plugin-transformed JS and `dist/` was not
 *    written.
 */
export const test_ttsccompiler_compile_applies_package_discovered_source_plugins =
  () => {
    const root = createProject({
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writePackageCompilerPlugin(root, "compile-fixture");
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.compile();

    assert.equal(result.type, "success");
    assert.match(expectRecordValue(result.output, "dist/main.js"), /PLUGIN/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
