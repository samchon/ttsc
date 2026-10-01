import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies TtscCompiler.compile does not accept per-call context overrides.
 *
 * Constructor options (`binary`, `cwd`, `plugins`) are sealed at construction
 * time. Callers should not be able to smuggle a different project root or a
 * dangerous binary path by passing a plain object as the first argument to
 * `compile()`. Pins the contract so downstream wrappers cannot accidentally
 * redirect the compiler to an untrusted project.
 *
 * 1. Construct a TtscCompiler pointing at a clean project with `plugins: false`.
 * 2. Call `compile()` with an object carrying a different `cwd`, `binary`, and
 *    `plugins`.
 * 3. Assert the result still reflects the constructor project (success with its
 *    output).
 *
 * @evidence contracts/testing.md#behavioral-verification Passes a forged per-call binary/cwd/plugin context to compile and checks the original api-ok project succeeds without writing either project dist.
 * @evidence contracts/testing.md#independent-expectations TtscCompiler binds context in its constructor and compile accepts no override; a nonexistent other binary/plugin must therefore be ignored rather than determine execution.
 * @evidence contracts/testing.md#distinguishing-cases The valid bound project is contrasted with an invalid alternate context containing a missing plugin and executable; the test checks runtime API behavior despite bypassing its TypeScript signature.
 * @evidence contracts/testing.md#execution-ownership The matching feature export calls compile against the native compiler through TestExecutor, with the extra argument deliberately cast through any.
 * @evidence contracts/e2e.md#necessary-boundary Actual process cwd and binary selection must stay bound when a JavaScript caller supplies an unsupported argument; static typing alone cannot establish that runtime boundary.
 * @evidence contracts/e2e.md#shared-execution One native compile result checks the bound context and absence of writes in both fixtures; the alternate project is not compiled or given a separate producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Two fresh registered fixtures distinguish the accepted context from the rejected alternative. The compiler receives plugins:false only at construction; both fixtures are removed by TestProject cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original success, api-ok literal and both no-dist assertions remain. It does not test every possible unsupported per-call option.
 */
export const test_ttsccompiler_compile_does_not_accept_per_call_context_overrides =
  () => {
    const root = createProject();
    const other = createProject({
      plugins: [{ transform: "./missing-plugin.cjs" }],
    });
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      plugins: false,
    });

    const result = (compiler.compile as any)({
      binary: path.join(other, "missing-tsgo"),
      cwd: other,
      plugins: [{ transform: "./missing-plugin.cjs" }],
    });

    assert.equal(result.type, "success");
    assert.match(expectRecordValue(result.output, "dist/main.js"), /api-ok/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
    assert.equal(fs.existsSync(path.join(other, "dist")), false);
  };
