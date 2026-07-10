import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeSourcePlugin,
} from "../../internal/compiler";

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
