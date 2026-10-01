import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
  writePackageCompilerPlugin,
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies TtscCompiler.compile applies package-discovered source plugins.
 *
 * Plugins declared via `ttsc.plugins` in `package.json` rather than in
 * `tsconfig.json` must be discovered and applied during `compile()`. Pins the
 * package-based auto-discovery path so projects that co-locate plugin config
 * with their package manifest (rather than tsconfig) get equivalent transform
 * behavior through the programmatic API.
 *
 * 1. Create a project with a plugin declared in `package.json` only.
 * 2. Call `compile()` via the programmatic API.
 * 3. Assert the output map contains the plugin-transformed JS and `dist/` was not
 *    written.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls compile on a package.json-discovered Go transform and checks successful JavaScript containing PLUGIN with no dist writes.
 * @evidence contracts/testing.md#independent-expectations The fixture authors goUpper("plugin") and its authored Go fixture replaces that literal marker with PLUGIN; package discovery must apply that behavior without a tsconfig plugin entry.
 * @evidence contracts/testing.md#distinguishing-cases The same-directory manifest positive distinguishes applying the discovered plugin from preserving the untransformed call; ancestor discovery and nearest-manifest termination have separate cases.
 * @evidence contracts/testing.md#execution-ownership The named API feature export is discovered by TestExecutor and executes plugin compilation and native compile transport.
 * @evidence contracts/e2e.md#necessary-boundary Package manifest loading, Go contributor assembly and returned JavaScript must connect through compile; direct discovery or transformation units cannot prove that chain.
 * @evidence contracts/e2e.md#shared-execution writePackageCompilerPlugin materializes the suite shared immutable contributor source; the content-addressed plugin cache and built package are reused, while this fresh project requires one native compile.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject owns a fresh source/config and package scope; shared binary reuse is keyed on producer inputs, not result text. Synchronous compile owns its process and TestProject releases registered fixtures at suite exit.
 * @evidence contracts/e2e.md#preserved-coverage Success, transformed PLUGIN output and no-dist publication assertions remain here. The output regex checks the literal rather than complete generated-program equivalence.
 */
export const test_ttsccompiler_compile_applies_package_discovered_source_plugins =
  () => {
    const root = createProject({
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writePackageCompilerPlugin(root, "compile-fixture");
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.compile();

    assert.equal(result.type, "success");
    assert.match(expectRecordValue(result.output, "dist/main.js"), /PLUGIN/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
