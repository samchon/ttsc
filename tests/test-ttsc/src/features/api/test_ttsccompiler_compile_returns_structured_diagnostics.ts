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
 * This ttsc API scenario is owned by a tests package instead of the production
 * package manifest, so package.json stays focused on build and publish
 * contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
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
