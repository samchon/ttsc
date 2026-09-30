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
 * Verifies TtscCompiler.compile returns structured diagnostics.
 *
 * `compile()` must return a `failure` result carrying a typed diagnostic array
 * rather than a thrown exception or an opaque stderr string. Pins the full
 * shape of a single diagnostic object — file path, category, code, position,
 * line/character, and message text — so downstream tools can map errors back to
 * source locations without parsing compiler output.
 *
 * 1. Create a project with a type error (string assigned to number).
 * 2. Call `compile()` via the programmatic API.
 * 3. Assert the result is `failure` with exactly one diagnostic carrying all
 *    required fields.
 *
 * @evidence contracts/testing.md#behavioral-verification Compiles the literal string-to-number assignment and asserts failure, one diagnostic with error category/code 2322, source location and not-assignable message, an output object and no dist publication.
 * @evidence contracts/testing.md#independent-expectations The incompatible string initializer and authored first-line identifier determine the assignment error and line 1/character 7 independently of the compiler result; TypeScript's assignment diagnostic contract supplies code 2322.
 * @evidence contracts/testing.md#distinguishing-cases This one semantic error checks structured metadata rather than only stderr or nonzero exit. Successful compile and syntax diagnostics belong to other entries; numeric start/length are type-checked rather than compared exactly.
 * @evidence contracts/testing.md#execution-ownership The named API feature is discovered by TestExecutor and runs real compile transport, not a synthetic diagnostic decoder.
 * @evidence contracts/e2e.md#necessary-boundary Native error output must be converted into the public structured diagnostic result without emitting dist; direct formatting or decoder tests cannot prove failure transport from a real compiler.
 * @evidence contracts/e2e.md#shared-execution One no-plugin compile produces every diagnostic and publication check. The suite shares its built JavaScript package and resolved tsgo; this source requires its own compiler invocation because it is intentionally invalid.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject registers a fresh fixture and config, so no prior output can satisfy the no-dist condition. The synchronous child completes before observation and the suite cleanup hook removes the fixture.
 * @evidence contracts/e2e.md#preserved-coverage All original diagnostic count/category/code/file/position/message checks and output-object/no-dist checks remain; the test does not assert exact end span or an empty output map.
 */
export const test_ttsccompiler_compile_returns_structured_diagnostics = () => {
  const root = createProject({
    source: 'const value: number = "not-a-number";\nconsole.log(value);\n',
  });
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.compile();

  assert.equal(result.type, "failure");
  assert.equal(result.diagnostics.length, 1);
  const diagnostic = expectArrayValue(result.diagnostics, 0);
  assert.ok(diagnostic.file);
  assert.equal(diagnostic.category, "error");
  assert.equal(diagnostic.code, 2322);
  assert.equal(typeof diagnostic.start, "number");
  assert.equal(typeof diagnostic.length, "number");
  assert.equal(diagnostic.line, 1);
  assert.equal(diagnostic.character, 7);
  assert.equal(diagnostic.file.endsWith("src/main.ts"), true);
  assert.match(diagnostic.messageText, /not assignable/);
  assert.equal(typeof result.output, "object");
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
};
