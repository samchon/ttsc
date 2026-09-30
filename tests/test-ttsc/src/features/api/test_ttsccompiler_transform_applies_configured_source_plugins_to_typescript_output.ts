import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
  writeSharedCompilerPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform applies configured source plugins to
 * TypeScript output.
 *
 * `transform()` runs the plugin pipeline and returns transformed TypeScript
 * source (not emitted JS). Pins the source-to-source path so bundler adapters
 * that need to feed plugin-transformed TS back to their own compiler receive
 * the `.ts` content and not any `.js` or `.d.ts` artifacts.
 *
 * 1. Create a project with a plugin that replaces a function call with an
 *    upper-cased string.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the result map contains the transformed TS source and no JS output
 *    keys.
 *
 * @evidence contracts/testing.md#behavioral-verification transform returns rewritten TypeScript, retains console.log and exposes no JavaScript or dist output.
 * @evidence contracts/testing.md#independent-expectations the source transformation API returns TypeScript while preserving surrounding statements and forbidding project emit; the fixture producer's explicit output is input to the host contract rather than an oracle for compiler AST semantics.
 * @evidence contracts/testing.md#distinguishing-cases changed literal, preserved use, absent JavaScript key and absent dist are all independently asserted.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsccompiler_transform_applies_configured_source_plugins_to_typescript_output function is an API E2E entry under src/features/api; it executes transform API, native source producer stdout and TypeScript-envelope decoding.
 * @evidence contracts/e2e.md#necessary-boundary This case owns transform API, native source producer stdout and TypeScript-envelope decoding; direct decoder or option calls cannot prove this assembly and caller-visible behavior.
 * @evidence contracts/e2e.md#shared-execution Five API consumers share one process-owned immutable compiler producer source and its keyed binary. Private descriptors, projects and API instances retain each case's inputs; source-mutation, proof-path and cold-cache cases keep their isolated producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared Go bytes never change in these five consumers; the product validates source, SDK and environment keys before artifact reuse. Each descriptor and project is private, and synchronous API return settles the native request. TestProject retains the immutable source until process exit and cleans it on exit.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion and counterexample below remains; only source preparation is shared, and the native envelope decoder matrix executes separately in source units.
 */
export function test_ttsccompiler_transform_applies_configured_source_plugins_to_typescript_output() {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeSharedCompilerPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /export const value = "PLUGIN"/,
    );
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /console\.log\(value\)/,
    );
    assert.equal(result.typescript["dist/main.js"], undefined);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
}
