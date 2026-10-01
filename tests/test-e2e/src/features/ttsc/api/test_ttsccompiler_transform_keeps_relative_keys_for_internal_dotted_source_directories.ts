import {
  TtscCompiler,
  assert,
  createDottedSourceProject,
  expectArrayValue,
  expectRecordValue,
  path,
  tsgo,
} from "../../../internal/ttsc/internal/compiler";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Transforms the ..src/main.ts fixture and requires its dotted-source literal under that relative key, success and no absolute source-map keys.
 * @evidence contracts/testing.md#independent-expectations The literal child directory ..src is not parent traversal; returned internal source keys stay project-relative by the API contract.
 * @evidence contracts/testing.md#distinguishing-cases This double-dot-prefix source spelling catches treating any startsWith("..") path as external; the compile dotted-outDir entry owns the output-key twin.
 * @evidence contracts/testing.md#execution-ownership The exported API feature is discovered by TestExecutor and performs native transform with plugins disabled.
 * @evidence contracts/e2e.md#necessary-boundary Actual native source paths must survive API normalization as relative keys; direct path-function tests cannot establish the producer emits the intended filename.
 * @evidence contracts/e2e.md#shared-execution One no-plugin transform supplies all key/content assertions, reusing the built package and resolved tsgo executable.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createDottedSourceProject allocates a fresh registered directory with an explicit files list; synchronous transform finishes before inspection and suite cleanup removes it.
 * @evidence contracts/e2e.md#preserved-coverage Exact ..src/main.ts lookup, dotted-source content, success and all-key nonabsolute check remain; actual external source roots have separate coverage.
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
