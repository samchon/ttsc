import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runExternalEmitProvenance } from "../../../../../packages/ttsc/src/compiler/internal/build/runExternalEmitProvenance";

/**
 * Verifies response inspection preserves the real external compiler protocol.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual provenance adapter with the installed pinned tsgo executable and a callback that really emits once. Supported nested, encoded and operand responses require exact physical source ownership; mutation and unsupported controls preserve the original producer result while refusing unproved ownership.
 * @evidence contracts/testing.md#independent-expectations The authored source and independent native realpath define ownership. Recorded callback argv and native process status/streams define the transport facts; expected options follow native last-occurrence and response-frame grammar rather than the inspector's returned tokens.
 * @evidence contracts/testing.md#distinguishing-cases Nested space-containing names, direct option order, literal @ operands, UTF8/UTF16 BOMs, changed response bytes, malformed/missing responses, unknown options, the native parser's EOF-token panic and profiling artifacts have separate labels. Errors are collected so unrelated controls still execute. Native parsing has no cycle guard; test_external_response_refusal_preserves_the_supplied_operation_failure separately owns bounded public refusal and supplied-operation failure propagation, without claiming native cyclic compilation succeeds.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns all compiler request labels; it calls authored adapter source but genuinely starts the external native producer and its read-only probes, so it is not a portable source unit.
 * @evidence contracts/e2e.md#necessary-boundary Native response decoding, argument grammar, actual compiler output and ownership admission must agree; a fabricated callback cannot establish those connections or the profiling artifact effect.
 * @evidence contracts/e2e.md#shared-execution All profiles share one installed immutable native compiler, one root project and authored source. Each option/response mutation requires its own actual emission and admission probes; no native artifact is rebuilt and no Node runtime host is started.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each label has its own output directory and response files; only the mutation label changes its response immediately before its emitting callback. Native children complete synchronously and TestProject owns all artifacts including the profiling output.
 * @evidence contracts/e2e.md#preserved-coverage Existing runtime response option and status assertions remain in their runtime owner. This adapter batch adds explicit producer-preservation, BOM, operand, freshness and artifact controls without replacing those Node effect assertions.
 */
export function test_external_response_provenance_preserves_the_actual_producer(): void {
  const root = TestProject.commonJsProject({ "src/main.ts": "export const answer: number = 42; export function optional(value?: { answer: number }) { return value?.answer; }" });
  const source = fs.realpathSync.native(path.join(root, "src/main.ts"));
  const utf16be = (text: string): Buffer => {
    const bytes = Buffer.from(text, "utf16le");
    for (let i = 0; i < bytes.length; i += 2) [bytes[i], bytes[i + 1]] = [bytes[i + 1]!, bytes[i]!];
    return Buffer.concat([Buffer.from([0xfe, 0xff]), bytes]);
  };
  const cases: { name: string; args: string[]; files?: Record<string, string | Buffer>; proof: boolean; status?: number; mutate?: string; artifact?: string; optional?: boolean }[] = [
    { name: "nested-space", args: ['@"outer args.txt"'], files: { "outer args.txt": '"@inner args.txt" --module commonjs\n', "inner args.txt": "--target es2019\n" }, proof: true, status: 0, optional: false },
    { name: "last-direct", args: ["@order.txt", "--target", "es2019"], files: { "order.txt": "--target esnext\n" }, proof: true, status: 0, optional: false },
    { name: "null-target", args: ["--target", "esnext", "--target", "null"], proof: true, status: 0 },
    { name: "literal-operand", args: ["--outDir", "@literal-output"], proof: true, status: 0 },
    { name: "utf8-bom", args: ["@bom8.txt"], files: { "bom8.txt": "\ufeff--module commonjs\n" }, proof: true, status: 0 },
    { name: "utf16le", args: ["@bomle.txt"], files: { "bomle.txt": Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("--module commonjs\n", "utf16le")]) }, proof: true, status: 0 },
    { name: "utf16be", args: ["@bombe.txt"], files: { "bombe.txt": utf16be("--module commonjs\n") }, proof: true, status: 0 },
    { name: "mutation", args: ["@changed.txt"], files: { "changed.txt": "--target es2019\n" }, mutate: "changed.txt", proof: false, status: 0 },
    { name: "native-eof-failure", args: ["@eof.txt"], files: { "eof.txt": "--module commonjs" }, proof: false },
    { name: "missing", args: ["@missing.txt"], proof: false },
    { name: "malformed", args: ["@malformed.txt"], files: { "malformed.txt": '--target "unterminated' }, proof: false },
    { name: "unknown", args: ["--noSuchCompilerOption"], proof: false },
    { name: "bom-profile", args: ["@profile.txt"], files: { "profile.txt": "\ufeff--pprofDir profile-output\n" }, proof: false, status: 0, artifact: "profile-output" },
  ];
  const failures: unknown[] = [];
  for (const scenario of cases) {
    try {
      for (const [name, contents] of Object.entries(scenario.files ?? {})) fs.writeFileSync(path.join(root, name), contents);
      const original = ["-p", "tsconfig.json", "--outDir", "output-" + scenario.name, "--listEmittedFiles", "true", ...scenario.args];
      // A command-line @ token names its file directly; only tokens inside a
      // response file use double quotes to preserve a space-containing path.
      if (scenario.name === "nested-space") original[original.length - 1] = "@outer args.txt";
      let calls = 0;
      let native: ReturnType<typeof TestProject.spawn> | undefined;
      const result = runExternalEmitProvenance({ args: original, cwd: root, binary: TestProject.TSGO_BINARY, env: process.env, run: (args) => {
        calls++;
        assert.deepEqual(args.slice(0, original.length), original, scenario.name);
        if (scenario.mutate) fs.appendFileSync(path.join(root, scenario.mutate), " \n");
        if (scenario.artifact) { assert.deepEqual(args, original); assert.equal(fs.existsSync(path.join(root, scenario.artifact)), false); }
        native = TestProject.spawn(TestProject.TSGO_BINARY, [...args], { cwd: root });
        return { result: { status: native.status ?? 1, stdout: native.stdout ?? "", stderr: native.stderr ?? "", diagnostics: [] }, completedNormally: native.status !== null && native.signal === null };
      } });
      assert.equal(calls, 1, scenario.name);
      assert.ok(native, scenario.name);
      assert.equal(result.status, native.status ?? 1, scenario.name);
      assert.equal(result.stderr, native.stderr ?? "", scenario.name);
      if (scenario.status !== undefined) assert.equal(result.status, scenario.status, result.stdout + result.stderr);
      else assert.notEqual(result.status, 0, scenario.name);
      for (const [label, diagnostic] of [
        ["missing", /TS5083/],
        ["malformed", /TS6045/],
        ["unknown", /TS5023/],
        ["native-eof-failure", /panic: runtime error: index out of range/],
      ] as const) if (scenario.name === label) assert.match(result.stdout + result.stderr, diagnostic);
      const output = path.join(root, scenario.name === "literal-operand" ? "@literal-output" : "output-" + scenario.name, "main.js");
      if (scenario.proof) {
        assert.deepEqual(result.emittedSources?.[output], [source], scenario.name);
        assert.equal(fs.readFileSync(output, "utf8").includes("?.answer"), scenario.optional ?? true, scenario.name);
      }
      else for (const owners of Object.values(result.emittedSources ?? {})) assert.deepEqual(owners, [], scenario.name);
      if (!scenario.proof && !scenario.mutate) assert.equal(result.stdout, native.stdout ?? "", scenario.name);
      if (scenario.mutate) {
        assert.deepEqual(result.emittedSources?.[output], [], scenario.name);
        assert.match(result.emittedSourceProofFailures?.[output] ?? "", /response file changed/i);
      }
      if (scenario.artifact) {
        const directory = path.join(root, scenario.artifact);
        assert.ok(fs.statSync(directory).isDirectory(), scenario.name);
        const artifacts = fs.readdirSync(directory);
        assert.ok(artifacts.length > 0, scenario.name);
        for (const artifact of artifacts) assert.ok(fs.statSync(path.join(directory, artifact)).size > 0, artifact);
      }
    } catch (error) { failures.push(new Error(scenario.name, { cause: error })); }
  }
  if (failures.length) throw new AggregateError(failures, "external compiler response boundaries failed");
}
