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
 * This ttsc API scenario is owned by a tests package instead of the production
 * package manifest, so package.json stays focused on build and publish
 * contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
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
