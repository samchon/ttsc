import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeSourcePlugin,
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies TtscCompiler.compile recovers TypeScript diagnostics from plugin
 * setup failure.
 *
 * Plugin presence is probed before the API selects its native-host or
 * plugin-backed path. A descriptor/source-build failure must still reach the
 * recoverable runBuild path, otherwise compile returns an exception before the
 * independent TypeScript check can expose source errors. The plugin failure
 * itself must stay visible as a `TTSC_PROCESS` diagnostic: embedders read
 * `IFailure.diagnostics`, not stderr, so recovered type errors must not replace
 * the plugin error.
 *
 * 1. Create a project with a TS2322 error and a source plugin.
 * 2. Corrupt the plugin's Go source so setup fails before its sidecar runs.
 * 3. Assert compile returns failure with the pure TypeScript diagnostic.
 * 4. Assert the plugin build failure is retained as a TTSC_PROCESS diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification Corrupts the Go plugin source and compiles a TypeScript assignment error; requires failure with both code 2322 and TTSC_PROCESS building-plugin diagnostics.
 * @evidence contracts/testing.md#independent-expectations The literal string assigned to number independently requires TypeScript error 2322, while intentionally invalid Go independently requires plugin setup failure; neither failure may hide the other.
 * @evidence contracts/testing.md#distinguishing-cases This combined failure distinguishes recovery from reporting only the first plugin build error. Successful plugin composition has separate API coverage.
 * @evidence contracts/testing.md#execution-ownership The named feature calls the checkout built TtscCompiler through the existing shared-cache subclass and selected resolveTsgo binary. Its unique corrupted Go-source input exercises actual setup/compiler recovery; it neither executes a successfully built contributor nor establishes packed installation.
 * @evidence contracts/e2e.md#necessary-boundary Only actual Go build failure followed by TypeScript diagnostic collection establishes that the JavaScript API retains both process and compiler failure families.
 * @evidence contracts/e2e.md#shared-execution One broken plugin input distinguishes setup rejection while the built package, selected compiler and keyed source cache are shared. All original predicates use one result; no plugin launch, new Program, process total or cold cache miss is inferred merely from that result.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The corrupted plugin belongs only to the registered project, so shared valid contributor sources remain untouched. The direct synchronous result precedes assertions and normal fixture cleanup is tracked by TestProject; it is not proof of arbitrary descendant closure or cleanup after forced interruption.
 * @evidence contracts/e2e.md#preserved-coverage Both original independent diagnostic predicates and failure assertion remain. Diagnostic ordering, count and no-output publication are not asserted by this case.
 */
export const test_ttsccompiler_compile_recovers_typescript_diagnostics_from_plugin_setup_failure =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'const wrong: number = "type-error";\nvoid wrong;\n',
    });
    writeSourcePlugin(root);
    const goFile = path.join(root, "plugin-go", "main.go");
    fs.writeFileSync(
      goFile,
      fs
        .readFileSync(goFile, "utf8")
        .replace("package main", "package main\nthis is not valid go;"),
      "utf8",
    );

    const result = new TtscCompiler({ binary: tsgo, cwd: root }).compile();

    assert.equal(result.type, "failure");
    assert.equal(
      result.diagnostics.some((diagnostic) => diagnostic.code === 2322),
      true,
    );
    assert.equal(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "TTSC_PROCESS" &&
          /building plugin/.test(diagnostic.messageText),
      ),
      true,
    );
  };
