import {
  TtscCompiler,
  assert,
  expectRecordValue,
  fs,
  path,
  tsgo,
  writePackageCompilerPlugin,
  writeSharedCompilerPlugin,
} from "../../../internal/ttsc/internal/compiler";
import { CompilerApiWorkspace } from "../../../internal/ttsc/internal/CompilerApiWorkspace";
import { Scenarios } from "../../../internal/Scenarios";

/**
 * Verifies how `TtscCompiler.compile` and `transform` find and apply a Go source
 * plugin, through one project directory.
 *
 * A source plugin turns `goUpper("plugin")` into `"PLUGIN"`. It is reached three
 * ways: a `compilerOptions.plugins` entry, a dependency package whose manifest
 * advertises a plugin, and the same package declared by an ancestor manifest
 * above the project. A nearer `package.json` ends that ancestor discovery. Each
 * way is asserted for the in-memory records and for writing nothing to disk.
 *
 * 1. Configure the plugin in tsconfig; compile and transform and assert the
 *    plugin output without a `dist` directory.
 * 2. Declare it only through a dependency package; compile and transform.
 * 3. Place the project below a workspace manifest and assert it is discovered,
 *    then add a manifest beside the project and assert it no longer is.
 *
 * @evidence contracts/testing.md#behavioral-verification Real native compile and transform calls apply the plugin through a configured entry and through package discovery (project and ancestor manifests), and leave the call unchanged once a nearer package.json exists; no call writes dist.
 * @evidence contracts/testing.md#independent-expectations The authored goUpper source and the plugin's documented uppercase contract fix the PLUGIN output and the unchanged goUpper spelling; whether discovery reaches an ancestor is the documented nearest-manifest rule, not read from the implementation.
 * @evidence contracts/testing.md#distinguishing-cases Configured and package-discovered plugins, ancestor discovery and its nearest-manifest negative are separate decisions; compile and transform records are asserted for the first two, and the ancestor pair uses compile.
 * @evidence contracts/testing.md#execution-ownership This ordinary test export is discovered by test-e2e src/index.ts and selected by evidence.config.json; it runs the native plugin loader and source producer through TtscCompiler, which unit tests of manifest parsing do not.
 * @evidence contracts/e2e.md#necessary-boundary Package-manifest discovery, descriptor loading, the Go plugin build and the in-memory API records meet only in a real run; a loader unit cannot show the built plugin transformed the source.
 * @evidence contracts/e2e.md#shared-execution Six former tests created six projects (two with workspace directories) for six native calls; one project directory now serves the same six calls, and the plugin binary is built once from the content-keyed shared source cache because only the descriptor location differs between states.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each state removes src, packages, node_modules, outputs and tsconfig before copying its overlay and writes its own descriptor, so a plugin installed by one discovery route cannot be found by the next; every call is a joined synchronous child and the workspace is removed in finally with its absence verified.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former configured and package-discovered compile and transform assertions, the ancestor discovery assertion and the nearest-manifest negative with its goUpper-unchanged check.
 */
export async function test_ttsccompiler_source_plugin_discovery_shares_one_project(): Promise<void> {
  const workspace = CompilerApiWorkspace.open();
  const failures: unknown[] = [];
  try {
    const root = workspace.root;
    const dist = path.join(root, "dist");
    const compilerFor = (cwd: string) => new TtscCompiler({ binary: tsgo, cwd });
    await Scenarios.collect("compiler source plugins", [
      ["configured_plugin", () => {
        CompilerApiWorkspace.enter(workspace, "goupper-configured");
        writeSharedCompilerPlugin(root);
        const compiler = compilerFor(root);
        const compiled = compiler.compile();
        assert.equal(compiled.type, "success");
        assert.match(expectRecordValue(compiled.output, "dist/main.js"), /PLUGIN/);
        assert.equal(fs.existsSync(dist), false);
        const transformed = compiler.transform();
        assert.equal(transformed.type, "success");
        assert.match(expectRecordValue(transformed.typescript, "src/main.ts"), /export const value = "PLUGIN"/);
        assert.match(expectRecordValue(transformed.typescript, "src/main.ts"), /console\.log\(value\)/);
        assert.equal(transformed.typescript["dist/main.js"], undefined);
        assert.equal(fs.existsSync(dist), false);
      }],
      ["package_discovered_plugin", () => {
        CompilerApiWorkspace.enter(workspace, "goupper-discovered");
        writePackageCompilerPlugin(root, "compile-fixture");
        const compiler = compilerFor(root);
        const compiled = compiler.compile();
        assert.equal(compiled.type, "success");
        assert.match(expectRecordValue(compiled.output, "dist/main.js"), /PLUGIN/);
        assert.equal(fs.existsSync(dist), false);
        const transformed = compiler.transform();
        assert.equal(transformed.type, "success");
        assert.match(expectRecordValue(transformed.typescript, "src/main.ts"), /export const value = "PLUGIN"/);
        assert.equal(fs.existsSync(dist), false);
      }],
      ["ancestor_manifest_discovery_and_nearest_manifest_stop", () => {
        CompilerApiWorkspace.enter(workspace, "ancestor");
        writePackageCompilerPlugin(root, "compile-fixture");
        const project = path.join(root, "packages", "app");
        const compiler = compilerFor(project);
        const discovered = compiler.compile();
        assert.equal(discovered.type, "success");
        assert.match(expectRecordValue(discovered.output, "dist/main.js"), /PLUGIN/);
        assert.equal(fs.existsSync(path.join(project, "dist")), false);

        fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ private: true }), "utf8");
        const stopped = compilerFor(project).compile();
        assert.equal(stopped.type, "success");
        assert.match(expectRecordValue(stopped.output, "dist/main.js"), /goUpper\("plugin"\)/);
        assert.doesNotMatch(expectRecordValue(stopped.output, "dist/main.js"), /PLUGIN/);
        assert.equal(fs.existsSync(path.join(project, "dist")), false);
      }],
    ]);
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      CompilerApiWorkspace.close(workspace);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Compiler source plugin states and cleanup failed.");
}
