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
 * Verifies TtscCompiler.transform applies package-discovered source plugins.
 *
 * Mirrors the `compile()` package-discovery test but for the `transform()`
 * path. Plugins declared in `package.json` must be discovered and applied when
 * the caller only wants transformed TypeScript source without a full emit. Pins
 * the auto-discovery path through the `transform()` surface so bundlers using
 * the source-only pipeline get the same plugin treatment as `compile()`.
 *
 * 1. Create a project with a plugin declared in `package.json` only.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the typescript map contains the plugin-transformed source.
 */
export const test_ttsccompiler_transform_applies_package_discovered_source_plugins =
  () => {
    const root = createProject({
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writePackageCompilerPlugin(root, "compile-fixture");
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /export const value = "PLUGIN"/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
