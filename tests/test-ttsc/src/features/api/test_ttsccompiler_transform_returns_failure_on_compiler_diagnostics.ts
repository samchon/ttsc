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
