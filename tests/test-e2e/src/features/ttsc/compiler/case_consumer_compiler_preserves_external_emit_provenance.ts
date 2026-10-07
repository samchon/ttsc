import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { runExternalEmitProvenance as Operation } from "../../../../../../packages/ttsc/src/compiler/internal/build/runExternalEmitProvenance";
import type { spawnNative as Spawn } from "../../../../../../packages/ttsc/src/compiler/internal/spawnNative";
import { TestProject } from "../../../../../utils/src/TestProject";

/**
 * Runs the preserved 41 profiles through the built, actually imported adapter.
 * The caller installs recorder.cjs once and copies the authored fixture tree
 * into its existing consumer. This case does not create another installation.
 * It is not activated until the instrumented legacy baseline has been
 * measured.
 *
 * @evidence contracts/testing.md#behavioral-verification Imports the actual built CJS adapter and spawn owner; readonly probes and the one emitting callback execute the same immutable recorder. Each row checks actual emit-log count, original argv/prefix/list admission, status7, literal stderr, physical singleton-or-empty ownership and refusal presence.
 * @evidence contracts/testing.md#independent-expectations Authored profiles preserve canonical JSX suffixes, unsupported structures, missing/ambiguous contributors and exact original item names. Native realpath supplies physical identity; fixture status and diagnostic are literal independent inputs.
 * @evidence contracts/testing.md#distinguishing-cases All41 original profiles remain separate, including response-frame argv, last overrides, both JSX source types and six non-JSX extensions. A nonzero normal exit cannot masquerade as build success.
 * @evidence contracts/testing.md#execution-ownership This exported case owns the adapter and actual process callback. Its caller owns prepared root/recorder and activation; a body alone is not discovery or executed coverage. Per-row failures retain item.name and are aggregated after all rows.
 * @evidence contracts/e2e.md#necessary-boundary Private readonly spawnNative probes must reach the actual selected recorder; supplied closures or AST extraction do not exercise their process transport and selected executable observations.
 * @evidence contracts/e2e.md#shared-execution One existing consumer and one installed recorder serve all41 profiles. Each native probe and emission remains an actual separately observed process, never an assumed reduction from sharing installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Synchronous native calls join before profile/log/output reset. Selected binary/source/config/response bytes remain unchanged within each invocation. Original profile/log bytes are restored in finally; caller owns root disposal and descendants remain outside synchronous direct-child proof.
 * @evidence contracts/e2e.md#preserved-coverage Preserves the original41 admission/attribution rows and writer1/argv/status7/stderr/physical ownership/refusal assertions. Donor remains until actual survivor selection and execution are proved; arbitrary compiler semantics are not certified by the recorder.
 */
export function case_consumer_compiler_preserves_external_emit_provenance(
  root: string,
  binary: string,
  env: NodeJS.ProcessEnv,
): void {
  const require = createRequire(import.meta.url);
  const operation = require(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/ttsc/lib/compiler/internal/build/runExternalEmitProvenance.js",
    ),
  ).runExternalEmitProvenance as typeof Operation;
  const spawn = require(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/ttsc/lib/compiler/internal/spawnNative.js",
    ),
  ).spawnNative as typeof Spawn;
  const rows = JSON.parse(
    fs.readFileSync(path.join(root, "profiles.json"), "utf8"),
  ) as Profile[];
  assert.equal(rows.length, 41);
  const profileFile = path.join(root, "provenance-profile.json");
  const logFile = path.join(root, "provenance-invocations.jsonl");
  const previous = [profileFile, logFile].map((file) =>
    fs.existsSync(file) ? fs.readFileSync(file) : undefined,
  );
  const failures: Error[] = [];
  let safeForNext = true;
  try {
    for (const [index, item] of rows.entries()) {
      if (!safeForNext) {
        failures.push(
          new Error(item.name + ": BLOCKED by unresolved previous request"),
        );
        continue;
      }
      try {
        const source = path.join(root, "src", `case${index}${item.extension}`);
        const output = path.join(root, "dist", `case${index}${item.suffix}`);
        const files = item.ambiguous
          ? [source, path.join(root, "src", `case${index}.jsx`)]
          : [source];
        assert.equal(fs.existsSync(source), !item.missing);
        const args = [
          "-p",
          path.join(root, "tsconfig.json"),
          ...(item.flags ?? []),
        ];
        if (item.response) args.push("@" + path.join(root, "flags.rsp"));
        const original = [...args];
        fs.writeFileSync(
          profileFile,
          JSON.stringify({
            hasJsx: Object.hasOwn(item, "jsx"),
            jsx: item.jsx,
            files,
            output,
          }),
        );
        fs.rmSync(logFile, { force: true });
        fs.rmSync(output, { force: true });
        let writerArgs: readonly string[] | undefined;
        safeForNext = false;
        const result = operation({
          args,
          binary,
          cwd: root,
          env,
          run(actual) {
            writerArgs = [...actual];
            const child = spawn(binary, actual, { cwd: root, env });
            safeForNext =
              child.error === undefined &&
              child.status !== null &&
              child.signal === null;
            if (child.error) throw child.error;
            return {
              completedNormally: child.status !== null && child.signal === null,
              result: {
                status: child.status ?? 1,
                diagnostics: [],
                stdout: String(child.stdout),
                stderr: String(child.stderr),
              },
            };
          },
        });
        const calls = fs
          .readFileSync(logFile, "utf8")
          .trim()
          .split(/\r?\n/)
          .map((line) => JSON.parse(line) as { phase: string; args: string[] });
        const writes = calls.filter((call) => call.phase === "emit");
        assert.equal(writes.length, 1);
        assert.deepEqual(writes[0]!.args, writerArgs);
        assert.deepEqual(args, original);
        assert.deepEqual(writerArgs!.slice(0, original.length), original);
        assert.equal(
          writerArgs!.includes("--listEmittedFiles"),
          item.admitted !== false,
        );
        assert.equal(result.status, 7);
        assert.equal(result.stderr, "fixture diagnostic preserved");
        assert.equal(
          fs.readFileSync(output, "utf8"),
          "// actual fixture writer bytes\n",
        );
        assert.deepEqual(
          result.emittedSources?.[output],
          item.admitted === false || item.ambiguous
            ? []
            : [fs.realpathSync.native(source)],
        );
        if (item.admitted === false || item.ambiguous)
          assert.ok(result.emittedSourceProofFailures?.[output]);
        else assert.equal(result.emittedSourceProofFailures, undefined);
      } catch (cause) {
        failures.push(new Error(item.name, { cause }));
      }
    }
  } finally {
    if (safeForNext)
      for (const [index, file] of [profileFile, logFile].entries()) {
        const bytes = previous[index];
        if (bytes === undefined) fs.rmSync(file, { force: true });
        else fs.writeFileSync(file, bytes);
      }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "external JSX provenance admission and ownership",
    );
}

interface Profile {
  name: string;
  jsx?: unknown;
  extension: string;
  suffix: string;
  admitted?: false;
  flags?: string[];
  response?: true;
  ambiguous?: true;
  missing?: true;
}
