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
 * Checks external provenance admission against literal native JSX layouts.
 *
 * The authored adapter and its private declarations execute with explicit
 * supplied showConfig/list operations and a fixture-owned writer. Those
 * operations are protocol inputs, not a native compiler or canonicalization
 * oracle. The fixture deliberately returns status 7, so association cannot be
 * mistaken for build success. Actual selected-producer emission remains
 * E2E-owned.
 *
 * 1. Exercise five canonical shown JSX strings for TSX and JSX sources.
 * 2. Keep malformed shown numeric/string values, missing inputs and ambiguous
 *    writers unknown.
 * 3. Preserve source observations, response frames, original arguments and
 *    supplied failure status.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes the exact authored provenance adapter and all private declarations, with real source/config/response/executable-identity files and real fixture writes; supplied read-only probe responses isolate admission and attribution without running a compiler.
 * @evidence contracts/testing.md#independent-expectations Literal canonical native JSX names use preserve=.jsx and all four other modes=.js. Literal invalid shown values have no supported producer contract; two distinct selected physical contributors remain ambiguous, and a missing selected source cannot establish ownership. Status 7 and literal diagnostics are preserved independently of association.
 * @evidence contracts/testing.md#distinguishing-cases All five canonical strings cover both TSX and JSX; react-native also covers TS/MTS/CTS/JS/MJS/CJS, with its own ambiguous and missing controls; numeric 1 through 5, 0, 6, empty, uppercase, unknown, null, one-element enum-name arrays, objects and boolean shown values remain unsupported. Undefined JSX with TS, supplied last overrides/case-normalized values, a real response frame, conflicting physical owners and missing source distinguish native layout admission from fabricated ownership.
 * @evidence contracts/testing.md#execution-ownership One source unit extracts actual declarations with ts-legacy and binds real classification, hashing, path and filesystem owners plus explicitly supplied probe operations. TestProject owns temporary files and cleanup; no native producer, executable invocation, actual enum canonicalization or emitted-artifact integration success is claimed. Every case is collected before AggregateError.
 */
export function test_external_emit_provenance_admits_native_jsx_layouts_without_inventing_owners(): void {
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
  const declarations = parsed.statements
    .filter(ts.isFunctionDeclaration)
    .map((node) => node.getText(parsed))
    .join("\n");
  const javascript = ts.transpileModule(declarations, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-provenance-jsx-layout-"),
  );
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "dist"));
  const binary = path.join(root, "supplied-probe.mjs"),
    config = path.join(root, "tsconfig.json");
  fs.writeFileSync(binary, "// fixture operation identity; never executed\n");
  fs.writeFileSync(config, "{}");
  interface Case {
    name: string;
    jsx: unknown;
    extension: string;
    suffix: string;
    admitted?: false;
    flags?: string[];
    response?: true;
    ambiguous?: true;
    missing?: true;
  }
  const cases: Case[] = [];
  for (const [jsx, suffix] of [
    ["preserve", ".jsx"],
    ["react", ".js"],
    ["react-native", ".js"],
    ["react-jsx", ".js"],
    ["react-jsxdev", ".js"],
  ])
    for (const extension of [".tsx", ".jsx"])
      cases.push({ name: jsx + extension, jsx, extension, suffix: suffix! });
  for (const jsx of [1, 2, 3, 4, 5, 0, 6, "", "PRESERVE", "unknown", null])
    cases.push({
      name: "unsupported-shown-" + JSON.stringify(jsx),
      jsx,
      extension: ".tsx",
      suffix: ".js",
      admitted: false,
    });
  cases.push({
    name: "no-jsx",
    jsx: undefined,
    extension: ".ts",
    suffix: ".js",
  });
  for (const flags of [
    ["--jsx", "react-native"],
    ["-JsX", "REACT-NATIVE"],
    ["--jsx", "preserve", "--jsx", "react-native"],
    ["--jsx", "react-native", "--jsx", "preserve"],
  ]) {
    const jsx = flags.at(-1)!.toLowerCase();
    cases.push({
      name: "supplied-effective-" + flags.join(" "),
      jsx,
      extension: ".tsx",
      suffix: jsx === "preserve" ? ".jsx" : ".js",
      flags,
    });
  }
  cases.push(
    {
      name: "response-frame",
      jsx: "react-native",
      extension: ".tsx",
      suffix: ".js",
      response: true,
    },
    {
      name: "ambiguous",
      jsx: "react",
      extension: ".tsx",
      suffix: ".js",
      ambiguous: true,
    },
    {
      name: "missing",
      jsx: "react",
      extension: ".tsx",
      suffix: ".js",
      missing: true,
      admitted: false,
    },
  );
  for (const [extension, suffix] of [
    [".ts", ".js"],
    [".mts", ".mjs"],
    [".cts", ".cjs"],
    [".js", ".js"],
    [".mjs", ".mjs"],
    [".cjs", ".cjs"],
  ])
    cases.push({
      name: "react-native-nonjsx-" + extension,
      jsx: "react-native",
      extension: extension!,
      suffix: suffix!,
    });
  cases.push(
    {
      name: "react-native-ambiguous",
      jsx: "react-native",
      extension: ".tsx",
      suffix: ".js",
      ambiguous: true,
    },
    {
      name: "react-native-missing",
      jsx: "react-native",
      extension: ".tsx",
      suffix: ".js",
      missing: true,
      admitted: false,
    },
  );
  for (const jsx of [
    ["preserve"],
    ["react-native"],
    { value: "preserve" },
    true,
  ])
    cases.push({
      name: "malformed-shown-structure-" + JSON.stringify(jsx),
      jsx,
      extension: ".tsx",
      suffix: ".js",
      admitted: false,
    });
  const failures: Error[] = [];
  for (const [index, item] of cases.entries()) {
    try {
      const base = "case" + index,
        source = path.join(root, "src", base + item.extension),
        other = path.join(root, "src", base + ".jsx"),
        output = path.join(root, "dist", base + item.suffix);
      if (!item.missing) fs.writeFileSync(source, "export const value = 1;\n");
      if (item.ambiguous) fs.writeFileSync(other, "export const other = 2;\n");
      const files = item.ambiguous ? [source, other] : [source];
      const shown = {
        compilerOptions: {
          rootDir: "src",
          outDir: "dist",
          ...(item.jsx === undefined ? {} : { jsx: item.jsx }),
        },
      };
      const args = ["-p", config, ...(item.flags ?? [])];
      if (item.response) {
        const response = path.join(root, "flags.rsp");
        fs.writeFileSync(response, "--jsx react-native\n");
        args.push("@" + response);
      }
      const original = [...args];
      const suppliedProbe = (
        _binary: string,
        probeArgs: readonly string[],
      ) => ({
        status: 0,
        signal: null,
        stdout: probeArgs.includes("--showConfig")
          ? JSON.stringify(shown)
          : files.join("\n") + "\n",
        stderr: "",
      });
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
        suppliedProbe,
        CompilerDiagnostics,
        PassthroughFlags,
      ) as typeof runExternalEmitProvenance;
      let writerArgs: readonly string[] | undefined;
      let writes = 0;
      const result = operation({
        args,
        binary,
        cwd: root,
        env: {},
        run: (actual) => {
          writerArgs = [...actual];
          writes++;
          fs.writeFileSync(output, "// actual fixture writer bytes\n");
          return {
            completedNormally: true,
            result: {
              status: 7,
              diagnostics: [],
              stdout: files.join("\n") + "\nTSFILE: " + output + "\n",
              stderr: "fixture diagnostic preserved",
            },
          };
        },
      });
      assert.equal(writes, 1);
      assert.deepEqual(args, original);
      assert.deepEqual(writerArgs!.slice(0, original.length), original);
      assert.equal(
        writerArgs!.includes("--listEmittedFiles"),
        item.admitted !== false,
      );
      assert.equal(result.status, 7);
      assert.equal(result.stderr, "fixture diagnostic preserved");
      assert.deepEqual(
        result.emittedSources?.[output],
        item.admitted !== false && !item.ambiguous
          ? [fs.realpathSync.native(source)]
          : [],
      );
      if (item.admitted === false || item.ambiguous)
        assert.ok(result.emittedSourceProofFailures?.[output]);
      else assert.equal(result.emittedSourceProofFailures, undefined);
    } catch (error) {
      failures.push(new Error(item.name, { cause: error }));
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "external JSX provenance admission and ownership",
    );
}
