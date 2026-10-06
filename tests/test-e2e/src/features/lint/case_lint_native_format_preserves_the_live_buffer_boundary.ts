import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { E2eProcessTrace } from "../../../../utils/src/E2eProcessTrace";
import type { PreparedAssetSelection } from "../../internal/captureE2ePreparedAssets";
import {
  type TracePhaseObservation,
  captureE2eTracePhase,
} from "../../internal/captureE2eTracePhase";
import { readE2eTraceMeasurements } from "../../internal/readE2eTraceMeasurements";

/**
 * Preserves the original shipped-binary dirty/clean buffer contract. Caller
 * supplies the prepared lint sidecar and original formatting selection,
 * project/tsconfig and disk file. The actual supported command consumes stdin;
 * no editor/LSP proxy or private buffer API is fabricated.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual lsp-execute-command with ttsc.format.document and content-stdin returns one URI edit with literal const x = 1; newline for dirty input, and literal null for clean const y = 2; newline. Real disk const onDisk = 999; newline must remain unchanged after both commands.
 * @evidence contracts/testing.md#independent-expectations Original dirty/clean/disk bytes, status0/empty stderr, URI edit count1 and complete newText are authored literals from TestLSPFormatBufferRealBinaryE2E. Expected URI uses the independently selected native file address; returned output cannot choose it.
 * @evidence contracts/testing.md#distinguishing-cases Dirty input differs from disk and requires an edit; clean input differs from both and requires null. Both actual command calls must succeed without disk mutation, distinguishing disk fallback, unconditional edits and protocol contamination.
 * @evidence contracts/testing.md#execution-ownership Callable body is authored but unregistered/unexecuted. Caller owns the real selected binary/format config/tsconfig/assets and producer/writer binding. This observes the native command's LSP-shaped result, not an actual editor/proxy connection.
 * @evidence contracts/e2e.md#necessary-boundary The real binary argv, URI/JSON arguments, stdin transport and serialized WorkspaceEdit/null must agree. Direct in-process format units do not establish that command assembly.
 * @evidence contracts/e2e.md#shared-execution Reuses the supplied common consumer, producer and immutable disk input; the two direct native calls remain separately measured with distinct Program lifetimes where applicable. It installs/builds no binary and adds no proxy process.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Uses only stdin and read-only disk/asset observations; no input rewrite or cleanup occurs. Fixed trace cursor separates callbacks. Original command result/error/stdio is retained; synchronous return is a direct-child observation, not arbitrary descendant join proof.
 * @evidence contracts/e2e.md#preserved-coverage Preserves dirty URI/newText and clean null/status/stderr contrasts plus final unchanged disk bytes. Original Go donor remains until actual registered survivor execution/coverage; range semantics not asserted by that donor are not added as replacement requirements.
 */
export async function case_lint_native_format_preserves_the_live_buffer_boundary(input: {
  directory: string;
  binary: string;
  file: string;
  tsconfig: string;
  pluginsJSON: string;
  traceRoot: string;
  producerAssets: readonly PreparedAssetSelection[];
  cacheRoots: readonly string[];
}): Promise<
  readonly TracePhaseObservation<ReturnType<typeof E2eProcessTrace.spawnSync>>[]
> {
  assert.ok(
    path.isAbsolute(input.directory) &&
      path.isAbsolute(input.binary) &&
      path.isAbsolute(input.file),
  );
  assert.ok(
    input.producerAssets.some(
      (asset) =>
        asset.role === "executable" &&
        fs.realpathSync.native(asset.file) ===
          fs.realpathSync.native(input.binary),
    ),
  );
  assert.equal(fs.readFileSync(input.file, "utf8"), "const onDisk = 999;\n");
  const uri = pathToFileURL(input.file).href;
  const phases: TracePhaseObservation<
    ReturnType<typeof E2eProcessTrace.spawnSync>
  >[] = [];
  const failures: unknown[] = [];
  let cursor = readE2eTraceMeasurements(
    input.traceRoot,
    [],
  ).lastWriterSequences;
  for (const row of [
    { name: "dirty-buffer", content: "const x = 1\n", edit: true },
    { name: "clean-buffer", content: "const y = 2;\n", edit: false },
  ]) {
    try {
      // A source-only format command need not traverse a Go traced constructor
      // or child boundary. Require the real owning spawn observer, not a
      // fabricated native writer file merely because the child returned a PID.
      const requiredWriterPids = [process.pid];
      const phase = await captureE2eTracePhase(
        {
          label: `format-${row.name}`,
          traceRoot: input.traceRoot,
          assets: [
            ...input.producerAssets,
            { label: "format-disk-input", file: input.file, role: "fixture" },
          ],
          cacheRoots: input.cacheRoots,
          afterSequences: cursor,
          requiredWriterPids,
        },
        async () => {
          const result = E2eProcessTrace.spawnSync(
            input.binary,
            [
              "lsp-execute-command",
              "--cwd",
              input.directory,
              "--tsconfig",
              input.tsconfig,
              "--plugins-json",
              input.pluginsJSON,
              "--command",
              "ttsc.format.document",
              "--arguments-json",
              JSON.stringify([uri]),
              "--content-stdin",
            ],
            {
              cwd: input.directory,
              env: process.env,
              input: row.content,
              encoding: "utf8",
              maxBuffer: 64 * 1024 * 1024,
            },
          );
          return result;
        },
      );
      phases.push(phase);
      if (phase.traces) cursor = phase.traces.lastWriterSequences;
      assert.deepEqual(phase.observationErrors, []);
      if (!phase.outcome.returned) throw phase.outcome.error;
      assert.equal(phase.outcome.returned, true);
      const result = phase.outcome.value;
      assert.ok(Number.isSafeInteger(result.pid) && result.pid > 0);
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0);
      assert.equal(result.signal, null);
      assert.equal(result.stderr, "");
      assert.ok(phase.traces);
      assert.deepEqual(phase.traces.integrityProblems, []);
      const processResults = phase.traces.processObservations.filter(
        ({ observation }) =>
          observation.writerPid === process.pid &&
          observation.event === "process-result" &&
          observation.pid === result.pid,
      );
      assert.equal(
        processResults.length,
        1,
        "actual owning synchronous process result",
      );
      if (row.edit) {
        const edit = JSON.parse(String(result.stdout));
        assert.deepEqual(Object.keys(edit.changes), [uri]);
        assert.equal(edit.changes[uri].length, 1);
        assert.equal(edit.changes[uri][0].newText, "const x = 1;\n");
      } else assert.equal(String(result.stdout).trim(), "null");
      assert.equal(
        fs.readFileSync(input.file, "utf8"),
        "const onDisk = 999;\n",
      );
      assert.ok(phase.assetsAfter);
      const before = phase.assetsBefore.find(
        (asset) => asset.label === "format-disk-input",
      )!;
      const after = phase.assetsAfter.find(
        (asset) => asset.label === "format-disk-input",
      )!;
      assert.equal(before.sha256, after.sha256);
      assert.equal(before.realPath, after.realPath);
      assert.deepEqual(before.identityAfter, after.identityBefore);
    } catch (error) {
      failures.push(new Error(row.name, { cause: error }));
    }
  }
  try {
    assert.equal(fs.readFileSync(input.file, "utf8"), "const onDisk = 999;\n");
  } catch (error) {
    failures.push(error);
  }
  if (failures.length)
    throw new AggregateError(failures, "Native live-buffer formatting");
  return phases;
}
