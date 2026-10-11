import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "ts-legacy";

import { CompilerArgumentsInspection } from "../../../../../packages/ttsc/src/compiler/internal/CompilerArgumentsInspection";
import { CompilerDiagnostics } from "../../../../../packages/ttsc/src/compiler/internal/build/CompilerDiagnostics";
import { PassthroughFlags } from "../../../../../packages/ttsc/src/compiler/internal/build/PassthroughFlags";
import type { runExternalEmitProvenance } from "../../../../../packages/ttsc/src/compiler/internal/build/runExternalEmitProvenance";
import { readCompilerOptionOccurrence } from "../../../../../packages/ttsc/src/flags/readCompilerOptionOccurrence";
import { resolveFlagSpec } from "../../../../../packages/ttsc/src/flags/resolveFlagSpec";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Checks that a compiler host unable to report its writes, a plugin library's
 * own executable such as typia's, still yields emit provenance.
 *
 * A provenance-requiring build used to reject such a host outright ("does not
 * support required emit provenance"), which broke every ttsx run over it. The
 * observed mode runs the host unchanged and attributes the predicted outputs
 * whose metadata moved across the run.
 *
 * 1. Run an observed host that writes one predicted output and leaves another,
 *    already present, untouched.
 * 2. Assert the written output belongs to its source, the untouched one is not
 *    claimed, and the host ran once with its original argv and status.
 * 3. Assert a layout the probes cannot cover leaves ownership unknown while the
 *    host still runs once.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes the exact authored provenance adapter and its private declarations with real source, config and output files; the supplied read-only probe responses stand in for tsgo while the fixture writer stands in for the foreign host.
 * @evidence contracts/testing.md#independent-expectations Literal rootDir/outDir layout predicts each output; which file the fixture writer touched sets the expected ownership, and status 7 and stderr are preserved independently.
 * @evidence contracts/testing.md#distinguishing-cases A newly written output, an untouched existing output and an unsupported outFile layout are separate rows.
 * @evidence contracts/testing.md#execution-ownership One source unit extracts the actual declarations with ts-legacy and binds real classification, path and filesystem owners plus supplied probe operations; no native compiler or plugin host runs.
 */
export function test_external_emit_provenance_observes_a_host_that_cannot_report_writes(): void {
  const text = fs.readFileSync(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/ttsc/src/compiler/internal/build/runExternalEmitProvenance.ts",
    ),
    "utf8",
  );
  const parsed = ts.createSourceFile(
    "runExternalEmitProvenance.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const javascript = ts.transpileModule(
    parsed.statements
      .filter(ts.isFunctionDeclaration)
      .map((node) => node.getText(parsed))
      .join("\n"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    },
  ).outputText;
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-provenance-observed-host-"),
  );
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "dist"));
  const binary = path.join(root, "supplied-probe.mjs");
  const config = path.join(root, "tsconfig.json");
  fs.writeFileSync(binary, "// fixture operation identity; never executed\n");
  fs.writeFileSync(config, "{}");
  const written = path.join(root, "src", "written.ts");
  const untouched = path.join(root, "src", "untouched.ts");
  fs.writeFileSync(written, "export const written = 1;\n");
  fs.writeFileSync(untouched, "export const untouched = 2;\n");
  const writtenOutput = path.join(root, "dist", "written.js");
  const untouchedOutput = path.join(root, "dist", "untouched.js");
  fs.writeFileSync(untouchedOutput, "// emitted by an earlier build\n");

  const operation = (shown: object) =>
    new Function(
      "exports",
      "fs",
      "path",
      "CompilerArgumentsInspection",
      "readCompilerOptionOccurrence",
      "resolveFlagSpec",
      "ensureExecutable",
      "spawnNative",
      "CompilerDiagnostics",
      "PassthroughFlags",
      javascript + "\nreturn runExternalEmitProvenance;",
    )(
      {},
      fs,
      path,
      CompilerArgumentsInspection,
      readCompilerOptionOccurrence,
      resolveFlagSpec,
      () => {
        throw new Error("Unexpected native permission operation");
      },
      (_binary: string, probeArgs: readonly string[]) => ({
        status: 0,
        signal: null,
        stdout: probeArgs.includes("--showConfig")
          ? JSON.stringify(shown)
          : [written, untouched].join("\n") + "\n",
        stderr: "",
      }),
      CompilerDiagnostics,
      PassthroughFlags,
    ) as typeof runExternalEmitProvenance;
  const observe = (shown: object) => {
    const args = ["-p", config];
    const runs: (readonly string[])[] = [];
    const result = operation(shown)({
      args,
      binary,
      cwd: root,
      env: {},
      run: (actual) => {
        runs.push([...actual]);
        fs.writeFileSync(writtenOutput, "// foreign host output\n");
        return {
          completedNormally: true,
          result: {
            status: 7,
            diagnostics: [],
            stdout: "host output without a write report\n",
            stderr: "fixture diagnostic preserved",
          },
        };
      },
      writes: "observed",
    });
    assert.deepEqual(runs, [args], "the host runs once with its own argv");
    assert.equal(result.status, 7);
    assert.equal(result.stderr, "fixture diagnostic preserved");
    assert.equal(result.stdout, "host output without a write report\n");
    return result;
  };

  const result = observe({
    compilerOptions: { rootDir: "src", outDir: "dist" },
  });
  assert.deepEqual(
    { ...result.emittedSources },
    {
      [writtenOutput]: [fs.realpathSync.native(written)],
    },
  );
  assert.equal(result.emittedSourceProofFailures, undefined);

  fs.rmSync(writtenOutput);
  const unsupported = observe({
    compilerOptions: { outFile: "dist/bundle.js" },
  });
  assert.equal(
    unsupported.emittedSources,
    undefined,
    "an unsupported layout leaves ownership unknown",
  );
}
