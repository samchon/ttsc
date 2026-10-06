import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../utils/src/E2eProcessTrace";
import type { PreparedAssetSelection } from "../../internal/captureE2ePreparedAssets";
import {
  type TracePhaseObservation,
  captureE2eTracePhase,
} from "../../internal/captureE2eTracePhase";
import { readE2eTraceMeasurements } from "../../internal/readE2eTraceMeasurements";
import { case_lint_loader_preserves_observed_raw_normalization } from "./case_lint_loader_preserves_observed_raw_normalization";

/**
 * Preserves the original registerHooks A-B-A loader witness after byte restore.
 * Caller prepares the original executable CJS hook/config/helper bytes and real
 * consumer. The official load hook changes the selected dependency while its
 * load is in progress, then restores it; this is authored loader interruption,
 * not a claim of kernel interruption or native notification delivery.
 *
 * @evidence contracts/testing.md#behavioral-verification A real native check evaluates the prepared CJS loader and consumes its actual result file. All actual raw/normalized helper fingerprints require identityStable false and empty digest despite final helper bytes equaling before; bounded native cache attempts remain not-current and return the last result uncached.
 * @evidence contracts/testing.md#independent-expectations Original before bytes and during config value are caller-authored fixture literals. Independent raw/native helper addresses are supplied from original selection, not trace-derived. False stability, empty digest and attempts1/2/3 with only the last returnedUncached true are supported native policy literals.
 * @evidence contracts/testing.md#distinguishing-cases Restored bytes alone cannot satisfy this profile: real evaluation, actual during value, unstable raw/native fingerprint and noncurrent cache result are all required. Warm cache-hit-only, wrong helper address or ordinary stable evaluation cannot substitute.
 * @evidence contracts/testing.md#execution-ownership Authored callable is unregistered/unexecuted. Caller owns original hook fixture/config/tsconfig, binary/SDK/loader binding and later joined cleanup. Native policy direct units do not establish this actual Node load/result-file/Go normalization connection.
 * @evidence contracts/e2e.md#necessary-boundary The official Node load-hook witness and real raw result-file fingerprint must survive native normalization and cached-loader consumption. An authored DTO, final-byte comparison or direct injected evaluator alone does not exercise that transport.
 * @evidence contracts/e2e.md#shared-execution Uses supplied common sidecar/consumer and existing actual hook fixture without building or installing. One native check may start three real evaluators due to the existing unstable retry policy; each is separately observed and not replaced with a static child-count forecast.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Reads fixed before bytes, passes original native command inputs unchanged and checks final restoration independently even when another assertion fails. The fixture's own finally owns its writes. Caller owns retained inputs/captures and actual descendant joins; Cmd.Run/raw records do not certify arbitrary descendants.
 * @evidence contracts/e2e.md#preserved-coverage Preserves actual during selection, before-byte restoration and raw/native false-stability/empty-digest refusal. Portable malformed-envelope/directory/optional-file policy remains in its Go unit; original real-loader donor is retained until actual survivor selection/execution.
 */
export async function case_lint_loader_preserves_aba_instability_after_restoration(input: {
  directory: string;
  binary: string;
  tsconfig: string;
  configFile: string;
  helperFile: string;
  beforeBytes: Buffer;
  duringValue: unknown;
  rawHelperPath: string;
  normalizedHelperPath: string;
  traceRoot: string;
  producerAssets: readonly PreparedAssetSelection[];
  cacheRoots: readonly string[];
}): Promise<
  TracePhaseObservation<ReturnType<typeof E2eProcessTrace.spawnSync>>
> {
  assert.ok(
    path.isAbsolute(input.directory) &&
      path.isAbsolute(input.binary) &&
      path.isAbsolute(input.helperFile),
  );
  assert.ok(
    input.producerAssets.some(
      (asset) =>
        asset.role === "executable" &&
        fs.realpathSync.native(asset.file) ===
          fs.realpathSync.native(input.binary),
    ),
  );
  assert.deepEqual(fs.readFileSync(input.helperFile), input.beforeBytes);
  const location = path.resolve(input.directory, input.configFile);
  const requiredWriterPids: number[] = [];
  const cursor = readE2eTraceMeasurements(
    input.traceRoot,
    [],
  ).lastWriterSequences;
  const phase = await captureE2eTracePhase(
    {
      label: "config-loader-aba",
      traceRoot: input.traceRoot,
      assets: [
        ...input.producerAssets,
        { label: "aba-config", file: location, role: "configuration" },
        { label: "aba-helper", file: input.helperFile, role: "fixture" },
      ],
      cacheRoots: input.cacheRoots,
      requiredWriterPids,
      afterSequences: cursor,
    },
    async () => {
      const result = E2eProcessTrace.spawnSync(
        input.binary,
        [
          "check",
          "--cwd",
          input.directory,
          "--tsconfig",
          input.tsconfig,
          "--plugins-json",
          JSON.stringify([
            { name: "@ttsc/lint", config: { configFile: input.configFile } },
          ]),
        ],
        {
          cwd: input.directory,
          env: process.env,
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
        },
      );
      if (Number.isSafeInteger(result.pid) && result.pid > 0)
        requiredWriterPids.push(result.pid);
      return result;
    },
  );
  const failures: unknown[] = [];
  try {
    assert.deepEqual(phase.observationErrors, []);
    if (!phase.outcome.returned) throw phase.outcome.error;
    assert.equal(phase.outcome.returned, true);
    const result = phase.outcome.value;
    assert.ok(Number.isSafeInteger(result.pid) && result.pid > 0);
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, String(result.stderr));
    assert.equal(result.stdout, "");
    assert.ok(phase.traces);
    case_lint_loader_preserves_observed_raw_normalization(
      input.traceRoot,
      phase.traces,
      {
        writerPid: result.pid,
        location,
        label: "config file",
        evaluations: [1, 2, 3].map(() => ({
          value: input.duringValue,
          rawDependencies: [
            {
              path: input.rawHelperPath,
              fields: { kind: "file", identityStable: false, digest: "" },
            },
          ],
          normalizedDependencies: [
            {
              path: input.normalizedHelperPath,
              fields: { kind: "file", identityStable: false, digest: "" },
            },
          ],
          absentRawPaths: [],
          absentNormalizedPaths: [],
          cacheOutcomes: ["not-current"],
        })),
        fixedOutputs: [],
      },
    );
    const caches = phase.traces.writerObservations
      .map((row) => row.observation)
      .filter(
        (row) =>
          row.writerPid === result.pid &&
          row.event === "config-cache-outcome" &&
          row.data?.location === location,
      )
      .sort((left, right) => left.sequence - right.sequence);
    assert.deepEqual(
      caches.map((row) => row.data?.attempt),
      [1, 2, 3],
    );
    assert.deepEqual(
      caches.map((row) => row.data?.returnedUncached),
      [false, false, true],
    );
  } catch (error) {
    failures.push(error);
  }
  try {
    assert.deepEqual(fs.readFileSync(input.helperFile), input.beforeBytes);
  } catch (error) {
    failures.push(new Error("ABA helper final bytes", { cause: error }));
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Actual loader ABA refusal and restoration",
    );
  return phase;
}
