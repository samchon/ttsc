import assert from "node:assert/strict";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/src/core/transform/filesystem/TtscTransformFilesystemOperations";
import { canDeliverCompilerSnapshot } from "../../../../../packages/unplugin/src/core/transform/generation/canDeliverCompilerSnapshot";
import { compilerSnapshotFailureClassifier } from "../../../../../packages/unplugin/src/core/transform/generation/compilerSnapshotFailureClassifier";
import { createGenerationProofFailures } from "../../../../../packages/unplugin/src/core/transform/generation/createGenerationProofFailures";
import { recordGenerationProofFailure } from "../../../../../packages/unplugin/src/core/transform/generation/recordGenerationProofFailure";
import { selectTransformAttemptDisposition } from "../../../../../packages/unplugin/src/core/transform/generation/selectTransformAttemptDisposition";

/**
 * Verifies coherent compiler output survives a source edit without gaining
 * cache, adoption or unknown-input authority.
 *
 * Disk freshness and the validity of a result compiled from captured text are
 * separate facts; losing the former must not spend stabilization retries.
 *
 * 1. Supply an authored successful snapshot and an observed source edit.
 * 2. Contrast adoption, missing producer proof and an unobserved plugin input.
 * 3. Assert only coherent local output bypasses the movement retry budget.
 *
 * @evidence contracts/testing.md#behavioral-verification Production admission and attempt disposition preserve a coherent source snapshot while refusing old adoptions, missing source proof, unrelated host changes and substituted observing views even with a positive streaming summary. Native capability callbacks are never invoked by admission.
 * @evidence contracts/testing.md#independent-expectations The authored graph, source and plugin paths establish which inputs the compiler captured; literal accepted/retry decisions follow read-once delivery versus future-reuse semantics. Explicit native versus substituted capability inputs define the view boundary without deriving expected verdicts from admission.
 * @evidence contracts/testing.md#distinguishing-cases A source edit, project membership change and source-backed host edit are accepted; missing ID, contradictory graph, incomplete producer observation, unknown failure, omitted evidence and foreign adoption are refused. Copied native defaults, custom watching and the native path dialect qualify; each substituted input capability, unavailable optional read, custom case policy and foreign path dialect refuses snapshot-only delivery.
 * @evidence contracts/testing.md#execution-ownership The test-unplugin unit runner discovers this export and calls portable admission functions without a compiler, consumer installation or host process.
 */
export function test_compiler_snapshot_delivery_preserves_freshness_boundaries(): void {
  const root = path.resolve("snapshot-project");
  const source = path.join(root, "source.ts");
  const result: ITtscCompilerTransformation.ISuccess = {
    type: "success",
    typescript: { "source.ts": 'export const value = "BEFORE";' },
    graph: {
      compilationSnapshot: "invocation-one",
      edges: { "source.ts": [] },
      globals: [],
      configs: [],
      inputObservations: {
        "source.ts": { readFile: { ok: true, hash: "before" } },
      },
    },
  };
  for (const scenario of [
    "source",
    "project",
    "host-source",
    "host-unknown",
    "host-conflict",
    "config",
    "missing-id",
    "conflict",
    "incomplete",
    "omitted",
    "unknown",
    "unknown-changed",
    "adopted",
  ] as const) {
    const current = structuredClone(result);
    const failures = createGenerationProofFailures();
    recordGenerationProofFailure(failures, {
      domain: scenario.startsWith("host-")
        ? "host"
        : scenario === "project" || scenario === "config"
          ? "project"
          : "graph",
      kind:
        scenario === "config"
          ? "config-state-changed"
          : scenario === "unknown"
            ? "proof-missing"
            : scenario === "unknown-changed"
              ? "authority-changed"
              : "content-changed",
      path:
        scenario === "host-unknown" ? path.join(root, "plugin.json") : source,
    });
    if (scenario === "host-conflict")
      current.hostInputHashes = { [source]: "another-evaluation" };
    if (scenario === "missing-id") delete current.graph!.compilationSnapshot;
    if (scenario === "conflict")
      current.graph!.inputProofFailures = { "source.ts": "content-changed" };
    if (scenario === "incomplete") current.observationsComplete = false;
    if (scenario === "omitted") failures.omitted = 1;
    const admitted = canDeliverCompilerSnapshot({
      result: current,
      projectRoot: root,
      failures,
      adopted: scenario === "adopted",
    });
    assert.equal(
      admitted,
      ["source", "project", "host-source"].includes(scenario),
      scenario,
    );
    const disposition = selectTransformAttemptDisposition({
      resultType: "success",
      configStateComplete: true,
      projectHeldStill: false,
      projectSnapshotComplete: false,
      snapshotDeliveryOnly: admitted,
      hostInputProofFailureCount: 0,
      failures,
      attempt: 0,
      moved: 0,
    });
    assert.equal(disposition.kind, admitted ? "accepted" : "retry", scenario);
  }

  const native = transformFilesystem(createTtscTransformCache());
  const views: {
    name: string;
    view: TtscTransformFilesystemOperations;
    admitted: boolean;
  }[] = [
    { name: "copied native defaults", view: native, admitted: true },
    {
      name: "native path dialect",
      view: { ...native, platform: process.platform },
      admitted: true,
    },
    {
      name: "custom watch",
      view: { ...native, watch: () => ({ close: () => {} }) },
      admitted: true,
    },
    {
      name: "foreign path dialect",
      view: {
        ...native,
        platform: process.platform === "win32" ? "linux" : "win32",
      },
      admitted: false,
    },
    {
      name: "custom case policy",
      view: { ...native, caseSensitive: () => true },
      admitted: false,
    },
    {
      name: "unavailable link bytes",
      view: { ...native, readlink: undefined },
      admitted: false,
    },
    {
      name: "unavailable raw directory",
      view: { ...native, readdirRaw: undefined },
      admitted: false,
    },
  ];
  for (const name of [
    "exists",
    "readFile",
    "readdir",
    "realpath",
    "stat",
    "statBigInt",
    "lstat",
    "readlink",
    "readdirRaw",
  ] as const)
    views.push({
      name: `substituted ${name}`,
      view: {
        ...native,
        [name]: () => {
          throw new Error("admission must not query input capabilities");
        },
      },
      admitted: false,
    });
  for (const scenario of views) {
    const current = structuredClone(result);
    TRANSFORM_RESULT_FILESYSTEM.set(current, scenario.view);
    const failures = createGenerationProofFailures(
      compilerSnapshotFailureClassifier(current, root),
    );
    recordGenerationProofFailure(failures, {
      domain: "graph",
      kind: "content-changed",
      path: source,
    });
    assert.equal(
      canDeliverCompilerSnapshot({
        result: current,
        projectRoot: root,
        failures,
        adopted: false,
      }),
      scenario.admitted,
      scenario.name,
    );
  }
}
