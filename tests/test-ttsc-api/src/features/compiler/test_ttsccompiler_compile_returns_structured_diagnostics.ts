import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.compile returns structured diagnostics.
 *
 * This ttsc API scenario is owned by a tests package instead of
 * the production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
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
  assert.equal(result.diagnostics[0].category, "error");
  assert.equal(result.diagnostics[0].code, 2322);
  assert.equal(typeof result.diagnostics[0].start, "number");
  assert.equal(typeof result.diagnostics[0].length, "number");
  assert.equal(result.diagnostics[0].line, 1);
  assert.equal(result.diagnostics[0].character, 7);
  assert.equal(result.diagnostics[0].file.endsWith("src/main.ts"), true);
  assert.match(result.diagnostics[0].messageText, /not assignable/);
  assert.equal(typeof result.output, "object");
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
};
