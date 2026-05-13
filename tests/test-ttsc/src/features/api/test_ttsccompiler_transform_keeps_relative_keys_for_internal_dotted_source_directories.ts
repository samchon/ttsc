import {
  TtscCompiler,
  assert,
  createDottedSourceProject,
  expectArrayValue,
  expectRecordValue,
  path,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform keeps relative keys for internal dotted
 * source directories.
 *
 * This ttsc API scenario is owned by a tests package instead of the production
 * package manifest, so package.json stays focused on build and publish
 * contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_ttsccompiler_transform_keeps_relative_keys_for_internal_dotted_source_directories =
  () => {
    const root = createDottedSourceProject();
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      plugins: false,
    });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.match(
      expectRecordValue(result.typescript, "..src/main.ts"),
      /dotted-source/,
    );
    assert.equal(
      Object.keys(result.typescript).some((key) => path.isAbsolute(key)),
      false,
    );
  };
