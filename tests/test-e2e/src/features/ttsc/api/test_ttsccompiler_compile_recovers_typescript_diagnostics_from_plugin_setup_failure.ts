import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeSourcePlugin,
  writeBasicProject,
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
 * @evidence contracts/e2e.md#shared-execution One broken plugin input distinguishes setup rejection using shared package/compiler/cache identities. Consolidated execution stages the same TS2322 source/default config/package and private corrupted module in the empty API allocation after the successful envelope batch. All predicates still use the original compile result; no plugin launch, Program/process total or cold miss is inferred.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Standalone registered project remains; borrowed execution requires an empty root before exact broken-input staging. Earlier valid modules/envelopes stay in retained siblings and shared contributors remain untouched. This is the final mutable API profile, retained by the family on success/failure. Direct synchronous return does not certify arbitrary descendants or forced-interruption cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Both original independent diagnostic predicates and failure assertion remain. Diagnostic ordering, count and no-output publication are not asserted by this case.
 */
export const test_ttsccompiler_compile_recovers_typescript_diagnostics_from_plugin_setup_failure =
  (preparedRoot?: string) => {
    const root = preparedRoot ?? createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'const wrong: number = "type-error";\nvoid wrong;\n',
    });
    if (preparedRoot !== undefined) {
      assert.deepEqual(fs.readdirSync(root), [], "borrowed broken-plugin root must be empty");
      writeBasicProject(root, 'const wrong: number = "type-error";\nvoid wrong;\n', {
        plugins: [{ transform: "./plugin.cjs" }],
      });
      fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ private: true }), "utf8");
    }
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
