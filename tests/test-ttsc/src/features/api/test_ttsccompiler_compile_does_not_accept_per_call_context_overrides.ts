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
