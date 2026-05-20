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
