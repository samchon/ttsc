import { inspect } from "node:util";
import {
  TtscCompiler,
  assert,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
} from "../../../internal/ttsc/internal/compiler";
import { Scenarios } from "../../../internal/Scenarios";
import { CompilerApiWorkspace } from "../../../internal/ttsc/internal/CompilerApiWorkspace";

/**
 * Verifies the plugin-free `TtscCompiler.compile` and `transform` operations
 * through one project and one compiler instance across its states.
 *
 * The API returns emit output or TypeScript source as in-memory records and must
 * write nothing to the project. The baseline project imports a helper and a
 * type-only model, so one `transform()` proves the source map holds every
 * included file, carries no emit keys and declares exactly those files complete.
 * The project is then entered in turn as a type error, a decorator-metadata
 * project and two projects whose directory names start with `..`, where the
 * native host can answer with absolute paths that the API must turn back into
 * project-relative keys. A forged per-call context must not redirect the sealed
 * compiler.
 *
 * 1. Compile and transform the baseline and assert records, absent disk output
 *    and the exact completeness list.
 * 2. Compile with a forged per-call binary, directory and plugin list and assert
 *    the sealed project still answers.
 * 3. Enter the type-error, decorated, dotted-output and dotted-source states and
 *    assert diagnostics, absent decorator metadata and relative keys.
 *
 * @evidence contracts/testing.md#behavioral-verification Real native compile and transform calls on one project assert emit and source records, structured TS2322 diagnostics with position, exact two-sided completeness lists, independent and connected graph edges, the reference graph on failure, absence of design:type metadata, relative dotted keys and that no dist directory is written.
 * @evidence contracts/testing.md#independent-expectations The authored sources fix every expected literal (api-ok, not-a-number, dotted-source, the three file names, line 1 character 7 and code 2322); the API contract that results are in-memory and project-relative is independent of the producer.
 * @evidence contracts/testing.md#distinguishing-cases Success, type-error failure, decorator-metadata and dotted-directory states are distinct decisions, each with its negative control (no emit keys, no absolute keys, no design:type, no dist); the forged-context call is the sealed-context negative.
 * @evidence contracts/testing.md#execution-ownership This ordinary test export is discovered by test-e2e src/index.ts under src/features and selected by tests/test-e2e/evidence.config.json; it runs the real native transform and compile lanes through TtscCompiler, so no unit call substitutes for it. Its named scenarios are collected to the end with body and cleanup failures retained. The shared compiler is the checkout built API subclass, not an installed package or one persistent native Program.
 * @evidence contracts/e2e.md#necessary-boundary The native producer's source and emit envelopes, diagnostics and path anchoring must cross the JavaScript API without touching disk; decoder or path-function units cannot show what the producer emits.
 * @evidence contracts/e2e.md#shared-execution One project and one JavaScript compiler instance serve seven named scenarios and nine API invocations; the baseline transform contributes source-record, included-file, completeness and independent-leaf observations together. Those static invocations and shared directory do not establish actual child reduction, native Program reuse or cache hits. A transient empty directory supplies the forged-context alternate project; measured process and construction events are separate.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each state resets the helper-owned source/output/package/node_modules trees and tsconfig before baseline/overlay copying; the directory helper does not reset shared process/module caches or join processes. Synchronous API outcomes precede the next state, while actual child/worker retirement remains owned by production. A standalone owner closes and verifies root absence; a borrowed owner leaves that directory to the shared family. Body and close errors remain aggregated; direct return is not arbitrary descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former output-record, no-write, structured-diagnostic, failure-source, source-record, no-emit-key, completeness, decorator-metadata, dotted-output, dotted-source and sealed-context assertions; the baseline main.ts now also imports a helper, so its declaration is asserted through the exported upper constant instead of an ambient message declaration.
 */
export async function test_ttsccompiler_plugin_free_compile_and_transform_share_one_project(preparedWorkspace?: CompilerApiWorkspace.IWorkspace): Promise<void> {
  const workspace = preparedWorkspace ?? CompilerApiWorkspace.open();
  const failures: unknown[] = [];
  try {
    const root = workspace.root;
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root, plugins: false });
    const dist = path.join(root, "dist");
    await Scenarios.collect("compiler api", [
      ["baseline_compile_and_transform", () => {
        CompilerApiWorkspace.enter(workspace, "baseline");
        const compiled = compiler.compile();
        assert.equal(compiled.type, "success", describe(compiled));
        assert.match(expectRecordValue(compiled.output, "dist/main.js"), /api-ok/);
        assert.match(
          expectRecordValue(compiled.output, "dist/main.js"),
          /console\.log\(\s*message\s*\)/,
        );
        assert.match(expectRecordValue(compiled.output, "dist/main.d.ts"), /upper: string/);
        assert.match(expectRecordValue(compiled.output, "dist/main.js.map"), /"version":3/);
        assert.match(expectRecordValue(compiled.output, "dist/main.d.ts.map"), /"version":3/);
        assert.equal(fs.existsSync(dist), false);

        const transformed = compiler.transform();
        assert.equal(transformed.type, "success", describe(transformed));
        const main = expectRecordValue(transformed.typescript, "src/main.ts");
        assert.match(main, /const message: string = "api-ok"/);
        assert.match(main, /console\.log\(\s*message\s*\)/);
        assert.match(main, /helper\(message\)/);
        assert.match(expectRecordValue(transformed.typescript, "src/helpers.ts"), /toUpperCase/);
        assert.match(expectRecordValue(transformed.typescript, "src/nested/model.ts"), /interface Model/);
        for (const key of Object.keys(transformed.typescript)) {
          assert.equal(key.startsWith("dist/"), false, key);
          assert.equal(/\.(?:js|cjs|mjs|d\.ts|map)$/.test(key), false, key);
        }
        assert.deepEqual(transformed.dependenciesComplete, [
          "src/helpers.ts",
          "src/isolated.ts",
          "src/main.ts",
          "src/nested/model.ts",
        ]);
        assert.equal(transformed.dependencies, undefined);
        assert.deepEqual(transformed.graph?.edges["src/isolated.ts"], []);
        assert.deepEqual([...(transformed.graph?.edges["src/main.ts"] ?? [])].sort(), [
          "src/helpers.ts",
          "src/nested/model.ts",
        ]);
        assert.equal(fs.existsSync(dist), false);
      }],
      ["forged_per_call_context_is_ignored", () => {
        CompilerApiWorkspace.enter(workspace, "baseline");
        const other = path.join(path.dirname(root), path.basename(root) + "-other");
        fs.mkdirSync(other);
        try {
          const forged = (compiler.compile as any)({
            binary: path.join(other, "missing-tsgo"),
            cwd: other,
            plugins: [{ transform: "./missing-plugin.cjs" }],
          });
          assert.equal(forged.type, "success", describe(forged));
          assert.match(expectRecordValue(forged.output, "dist/main.js"), /api-ok/);
          assert.equal(fs.existsSync(dist), false);
          assert.equal(fs.existsSync(path.join(other, "dist")), false);
        } finally {
          fs.rmSync(other, { recursive: true, force: true });
        }
      }],
      ["type_error_reports_structured_diagnostics", () => {
        CompilerApiWorkspace.enter(workspace, "type-error");
        const failed = compiler.compile();
        assert.equal(failed.type, "failure", describe(failed));
        assert.equal(failed.diagnostics.length, 1);
        const diagnostic = expectArrayValue(failed.diagnostics, 0);
        assert.ok(diagnostic.file);
        assert.equal(diagnostic.category, "error");
        assert.equal(diagnostic.code, 2322);
        assert.equal(typeof diagnostic.start, "number");
        assert.equal(typeof diagnostic.length, "number");
        assert.equal(diagnostic.line, 1);
        assert.equal(diagnostic.character, 7);
        assert.equal(diagnostic.file.endsWith("src/main.ts"), true);
        assert.match(diagnostic.messageText, /not assignable/);
        assert.equal(typeof failed.output, "object");
        assert.equal(fs.existsSync(dist), false);
        const failedSource = compiler.transform();
        assert.equal(failedSource.type, "failure", describe(failedSource));
        assert.equal(expectArrayValue(failedSource.diagnostics, 0).code, 2322);
        assert.match(expectRecordValue(failedSource.typescript, "src/main.ts"), /not-a-number/);
        assert.equal(fs.existsSync(dist), false);
      }],
      ["failure_carries_the_reference_graph", () => {
        CompilerApiWorkspace.enter(workspace, "graph-failure");
        const result = compiler.transform();
        assert.equal(result.type, "failure", describe(result));
        assert.ok(result.graph, "failure result must carry the reference graph");
        assert.deepEqual(result.graph.edges["src/main.ts"], ["src/mytype.ts"]);
      }],
      ["decorator_metadata_keeps_completeness", () => {
        CompilerApiWorkspace.enter(workspace, "decorated");
        const decorated = compiler.transform();
        assert.equal(decorated.type, "success", describe(decorated));
        assert.equal(decorated.typescript["src/main.ts"]?.includes("design:type"), false);
        assert.deepEqual(decorated.dependenciesComplete, ["src/main.ts", "src/types.ts"]);
      }],
      ["dotted_output_directory_keeps_relative_keys", () => {
        CompilerApiWorkspace.enter(workspace, "dotted-output");
        const dottedOutput = compiler.compile();
        assert.equal(dottedOutput.type, "success", describe(dottedOutput));
        assert.match(expectRecordValue(dottedOutput.output, "..dist/main.js"), /api-ok/);
        assert.equal(Object.keys(dottedOutput.output).some((key) => path.isAbsolute(key)), false);
        assert.equal(fs.existsSync(path.join(root, "..dist")), false);
      }],
      ["dotted_source_directory_keeps_relative_keys", () => {
        CompilerApiWorkspace.enter(workspace, "dotted-source");
        const dottedSource = compiler.transform();
        assert.equal(dottedSource.type, "success", describe(dottedSource));
        assert.match(expectRecordValue(dottedSource.typescript, "..src/main.ts"), /dotted-source/);
        assert.equal(Object.keys(dottedSource.typescript).some((key) => path.isAbsolute(key)), false);
      }],
    ]);
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      if (!preparedWorkspace) CompilerApiWorkspace.close(workspace);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Compiler API states and cleanup failed.");
}

/** Names a native exception in a failed type assertion so its cause is not lost. */
function describe(result: { type: string; error?: unknown }): string {
  return result.type === "exception" ? inspect(result, { depth: 6 }) : "";
}
