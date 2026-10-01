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
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies TtscCompiler.compile applies configured source plugins without
 * project output.
 *
 * `compile()` must run the plugin transform pipeline and return the emitted
 * JavaScript in its result map without ever writing files to disk. Pins the
 * in-memory output contract so bundler adapters and API callers can consume
 * plugin-transformed JS without side-effecting the project directory.
 *
 * 1. Create a project with a source plugin that upper-cases a string literal.
 * 2. Call `compile()` via the programmatic API.
 * 3. Assert the output map contains the transformed JS and `dist/` was not
 *    written.
 *
 * @evidence contracts/testing.md#behavioral-verification compile returns PLUGIN JavaScript and leaves dist absent.
 * @evidence contracts/testing.md#independent-expectations the in-memory API returns native producer output without publishing it to the project; the fixture producer's explicit output is input to the host contract rather than an oracle for compiler AST semantics.
 * @evidence contracts/testing.md#distinguishing-cases configured native output is present and project output is absent.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsccompiler_compile_applies_configured_source_plugins_without_project_output function is an API E2E entry under src/features/api; it executes compile API, real Go source build, sidecar build command and in-memory JavaScript collection.
 * @evidence contracts/e2e.md#necessary-boundary This case owns compile API, real Go source build, sidecar build command and in-memory JavaScript collection; direct decoder or option calls cannot prove this assembly and caller-visible behavior.
 * @evidence contracts/e2e.md#shared-execution Five API consumers share one process-owned immutable compiler producer source and its keyed binary. Private descriptors, projects and API instances retain each case's inputs; source-mutation, proof-path and cold-cache cases keep their isolated producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared Go bytes never change in these five consumers; the product validates source, SDK and environment keys before artifact reuse. Each descriptor and project is private, and synchronous API return closes the capture operation. TestProject retains the immutable source until process exit and cleans it on exit.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion and counterexample below remains; only source preparation is shared, and the native envelope decoder matrix executes separately in source units.
 */
export function test_ttsccompiler_compile_applies_configured_source_plugins_without_project_output() {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeSharedCompilerPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.compile();

    assert.equal(result.type, "success");
    assert.match(expectRecordValue(result.output, "dist/main.js"), /PLUGIN/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
}
