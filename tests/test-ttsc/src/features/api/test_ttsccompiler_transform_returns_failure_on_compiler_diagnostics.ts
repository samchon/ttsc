import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform returns failure on compiler diagnostics.
 *
 * Unlike `compile()`, `transform()` still returns the TypeScript source even
 * when there are type errors so bundler adapters can show the source location
 * alongside the diagnostic. Pins the dual contract: the result type is
 * `failure`, the diagnostics array carries the error code, but the `typescript`
 * map still contains the source files.
 *
 * 1. Create a project with a type error (string assigned to number).
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the result is `failure` with the error code and the typescript map is
 *    populated.
 * @evidence contracts/testing.md#behavioral-verification Transforms the string-to-number error and checks failure with diagnostic 2322 while the typescript map still contains the bad source and dist remains absent.
 * @evidence contracts/testing.md#independent-expectations The literal not-a-number initializer violates its number annotation; source-mode failure retains source text for consumers, independently of whether emitted JavaScript would be allowed.
 * @evidence contracts/testing.md#distinguishing-cases This failure retains source alongside diagnostics, unlike successful transform and compile's emitted-output contract. Exact diagnostic locations are checked by compile_returns_structured_diagnostics.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the matching feature export and runs a real native transform through the JavaScript API.
 * @evidence contracts/e2e.md#necessary-boundary Real compiler diagnostics and source must coexist in a transported failure result. A decoder unit cannot verify native source-mode failure emission or absence of project writes.
 * @evidence contracts/e2e.md#shared-execution One transform process supplies failure, diagnostic, retained-source and publication checks; plugins are disabled and the package build/tsgo executable are shared by the suite.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The intentionally erroneous source lives in a fresh registered fixture with no initial dist. Synchronous transform owns process completion and TestProject removes the fixture at suite exit.
 * @evidence contracts/e2e.md#preserved-coverage Successor execution retains all four original distinctions: failure, code 2322, retained literal source and no dist. It does not claim full diagnostic equality or all-error aggregation.
 */
export const test_ttsccompiler_transform_returns_failure_on_compiler_diagnostics =
  () => {
    const root = createProject({
      source: 'const value: number = "not-a-number";\nconsole.log(value);\n',
    });
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      plugins: false,
    });

    const result = compiler.transform();

    assert.equal(result.type, "failure");
    assert.equal(expectArrayValue(result.diagnostics, 0).code, 2322);
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /not-a-number/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
