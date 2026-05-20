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
 * When `rootDir` starts with `..` (e.g. `..src`) the Go binary can emit
 * absolute source paths because the anchor lies outside the project root. Pins
 * the normalization pass that converts these back to relative keys in the
 * `typescript` result map so the `transform()` surface always returns a uniform
 * `Record<string, string>` regardless of the tsconfig directory layout.
 *
 * 1. Create a project with a dotted-prefix source directory (e.g. `..src`).
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert all keys in the typescript map are relative (none are absolute paths).
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
