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
 * Verifies rediscovered roots cannot invalidate a reported emitting selection.
 * showConfig expands its files again after emission, so those roots describe
 * another filesystem instant; settings and ambiguous owners remain guarded.
 *
 * 1. Supply before/after configuration reports around one fixture-owned emit.
 * 2. Assert added roots and formatting preserve reported ownership, while settings
 *    changes, failed inspection and selection differences refuse it.
 * 3. Reinspect changed roots for an unreported host, rejecting a new contributor
 *    when it could overwrite an existing output.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes the authored adapter and private functions with supplied read-only compiler reports and real fixture source/output/executable files. Assertions distinguish completed-source ownership from fresh root discovery while preserving one producer invocation, status and streams.
 * @evidence contracts/testing.md#independent-expectations Literal rootDir/outDir and the fixture-written main.js define ownership of the physical main.ts. A new root has no emitted output; independent option/include changes and unavailable reports cannot establish unchanged settings.
 * @evidence contracts/testing.md#distinguishing-cases Both modes cover stable configuration, formatting, added roots, changed layout, nested options, include patterns and failed/malformed config inspection. An observed host also rejects a newly selected output collision and unavailable post-emission source selection; a reporting producer's exact selection remains sufficient. Reported mode rejects a mismatching emitting selection. Source text edits retain physical owners. The native response E2E owns real root expansion.
 * @evidence contracts/testing.md#execution-ownership One discovered source unit extracts the actual functions with ts-legacy and supplies their process boundary, following the adjacent provenance units. TestProject owns temporary allocation/cleanup; no compiler or host is launched. All rows finish before AggregateError reports their named failures.
 */
export function test_external_emit_provenance_separates_settings_from_rediscovered_roots(): void {
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
    TestProject.tmpdir("ttsc-provenance-settings-"),
  );
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "dist"));
  const binary = path.join(root, "supplied-probe.mjs");
  const config = path.join(root, "tsconfig.json");
  const source = path.join(root, "src", "main.ts");
  const added = path.join(root, "src", "added.ts");
  const conflicting = path.join(root, "src", "main.tsx");
  const output = path.join(root, "dist", "main.js");
  fs.writeFileSync(binary, "// supplied probe identity; never executed\n");
  fs.writeFileSync(config, "{}");
  fs.writeFileSync(source, "export const value = 1;\n");
  const before = {
    compilerOptions: {
      rootDir: "src",
      outDir: "dist",
      plugins: [{ transform: "example", options: { enabled: true } }],
    },
    files: ["./src/main.ts"],
    include: ["src"],
  };
  const cases = [
    { name: "stable", after: before, proved: true },
    { name: "formatting", after: before, proved: true, pretty: true },
    {
      name: "added-root",
      after: { ...before, files: [...before.files, "./src/added.ts"] },
      proved: true,
      addRoot: true,
    },
    {
      name: "added-conflicting-root",
      after: {
        ...before,
        files: [...before.files, "./src/added.ts", "./src/main.tsx"],
      },
      proved: true,
      addRoot: true,
      conflict: true,
      observedRefusal: /distinct physical source candidates/,
    },
    {
      name: "added-root-source-inspection-unavailable",
      after: { ...before, files: [...before.files, "./src/added.ts"] },
      proved: true,
      addRoot: true,
      missingSourceList: true,
      observedRefusal: /Source-list inspection/,
    },
    {
      name: "output-layout",
      after: {
        ...before,
        compilerOptions: { ...before.compilerOptions, outDir: "elsewhere" },
      },
      proved: false,
    },
    {
      name: "nested-option",
      after: {
        ...before,
        compilerOptions: {
          ...before.compilerOptions,
          plugins: [{ transform: "example", options: { enabled: false } }],
        },
      },
      proved: false,
    },
    {
      name: "include-pattern",
      after: { ...before, include: ["src/main.ts"] },
      proved: false,
    },
    { name: "failed-inspection", after: before, proved: false, status: 1 },
    { name: "malformed-inspection", after: {}, proved: false },
    { name: "changed-selection", after: before, proved: false, mismatch: true },
    { name: "edited-source", after: before, proved: true, edit: true },
  ];
  const failures: Error[] = [];
  for (const writes of ["reported", "observed"] as const)
    for (const item of cases) {
      if (writes === "observed" && item.mismatch) continue;
      const label = writes + ":" + item.name;
      try {
        // A prior output must not decide whether an observed host wrote now.
        if (fs.existsSync(output)) fs.unlinkSync(output);
        let emitted = false;
        let calls = 0;
        const operation = new Function(
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
          (_binary: string, args: readonly string[]) => ({
            status: emitted ? (item.status ?? 0) : 0,
            signal: null,
            stdout: args.includes("--showConfig")
              ? JSON.stringify(
                  emitted ? item.after : before,
                  null,
                  emitted && item.pretty ? 2 : undefined,
                )
              : emitted && item.missingSourceList
                ? ""
                : [
                    source,
                    ...(emitted && item.addRoot ? [added] : []),
                    ...(emitted && item.conflict ? [conflicting] : []),
                  ].join("\n") + "\n",
            stderr: "",
          }),
          CompilerDiagnostics,
          PassthroughFlags,
        ) as typeof runExternalEmitProvenance;
        const args = ["-p", config];
        const stdout =
          writes === "reported"
            ? (item.mismatch ? added : source) + "\nTSFILE: " + output + "\n"
            : "host output\n";
        const result = operation({
          args,
          binary,
          cwd: root,
          env: {},
          writes,
          run: (actual) => {
            calls++;
            assert.deepEqual(
              actual,
              writes === "observed"
                ? args
                : [
                    ...args,
                    "--listFiles",
                    "true",
                    "--listEmittedFiles",
                    "true",
                  ],
            );
            fs.writeFileSync(output, "// completed fixture output\n");
            if (item.addRoot)
              fs.writeFileSync(added, "export const added = 1;\n");
            if (item.conflict)
              fs.writeFileSync(conflicting, "export const conflict = 1;\n");
            if (item.edit)
              fs.writeFileSync(source, "export const value = 2;\n");
            emitted = true;
            return {
              completedNormally: true,
              result: {
                status: 7,
                diagnostics: [],
                stdout,
                stderr: "preserved",
              },
            };
          },
        });
        const proved =
          item.proved && !(writes === "observed" && item.observedRefusal);
        assert.equal(calls, 1);
        assert.equal(result.status, 7);
        assert.equal(result.stderr, "preserved");
        assert.equal(
          result.stdout,
          writes === "observed" || item.mismatch
            ? stdout
            : "TSFILE: " + output + "\n",
        );
        assert.deepEqual(
          result.emittedSources?.[output],
          proved ? [source] : [],
        );
        assert.equal(
          result.emittedSources?.[path.join(root, "dist", "added.js")],
          undefined,
        );
        if (proved) assert.equal(result.emittedSourceProofFailures, undefined);
        else
          assert.match(
            result.emittedSourceProofFailures?.[output] ?? "",
            item.mismatch
              ? /source selection differs/
              : (item.observedRefusal ?? /Effective configuration changed/),
          );
      } catch (error) {
        failures.push(new Error(label, { cause: error }));
      } finally {
        if (fs.existsSync(added)) fs.unlinkSync(added);
        if (fs.existsSync(conflicting)) fs.unlinkSync(conflicting);
      }
    }
  if (failures.length)
    throw new AggregateError(
      failures,
      "external provenance configuration boundaries",
    );
}
