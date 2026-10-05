import assert from "node:assert/strict";
import { TextDecoder } from "node:util";

import type { PreparedAssetObservation } from "../../../internal/captureE2ePreparedAssets";
import type { TraceMeasurements } from "../../../internal/readE2eTraceMeasurements";
import { readE2eTracePayload } from "../../../internal/readE2eTracePayload";

/**
 * Verifies the actual Node reply reaches its native bridge with paired digests.
 *
 * The shared consumer invokes the real contributor and joins its request before
 * calling this scene with the captured phase. Expectations are the selected
 * fixture's literal request/response IDs, not trace-produced document IDs.
 *
 * 1. Require one exact native lookup and its real Run/request/result invocation.
 * 2. Decode that invocation's captured stdout bytes independently.
 * 3. Compare literal reply IDs and the already-used native digest observations.
 *
 * @evidence contracts/testing.md#behavioral-verification Pairs actual nativeLookup/request/process-result/bridge-result rows, reads their owned raw capture, and checks original JSON document/problem attribution and native unmarshal IDs without reconstructing a reply.
 * @evidence contracts/testing.md#independent-expectations Caller supplies authored ordered lookup/request sources and literal document/problem IDs plus readable/rejected versus missing/remote digest policy. Fixed local source asset observations must agree before and after; model/field/operation semantics remain direct-unit responsibilities.
 * @evidence contracts/testing.md#distinguishing-cases Cold requested sources require actual miss and real started/exited status0 Run; cache hits cannot substitute for the connection. Nonempty local digest contrasts empty wire digest and absent native Swagger entry. Pending subset is explicit and is not assumed equal to all lookup sources.
 * @evidence contracts/testing.md#execution-ownership This callable scene is not registered or executed. Its future common-consumer caller owns actual invocation, joined writer PID, prepared assets and phase cursor; an authored DTO or private trace alone is not product execution proof.
 * @evidence contracts/e2e.md#necessary-boundary Actual built loader resolution, Node stdout and native unmarshal must agree in one real process invocation; independent parser/native policy units do not exercise that assembly or transport.
 * @evidence contracts/e2e.md#shared-execution Consumes one request already run by the shared installed consumer, starts no additional child and creates no installation. Original model/policy contributions are kept in direct units rather than rerun through a new host per assertion.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Caller joins the actual command and writers and retains the fixed trace root before reading. Phase cursor excludes earlier invocations; exact source assets must retain bytes/native identities. Digest equality does not certify a changing-source race, remote bytes or arbitrary descendants.
 * @evidence contracts/e2e.md#preserved-coverage Retains actual raw JSON/source ordering/failure attribution/native digest transfer separately from T/G literal owners. Direct calls nativeLookup=false, cache-hit-only and failed/truncated/missing captures cannot count as surviving connection; original donors remain until actual execution and coverage.
 */
export function case_evidence_bridge_preserves_observed_json_transport(
  traceRoot: string,
  traces: TraceMeasurements,
  expected: {
    writerPid: number;
    bridge: "prisma" | "swagger";
    root: string;
    lookupSources: readonly string[];
    requestSources: readonly string[];
    documentIds: readonly string[];
    problemIds: readonly string[];
    digests: readonly {
      id: string;
      native: "present" | "absent";
      wire: "nonempty" | "empty";
    }[];
    fixedAssetLabels: readonly string[];
  },
  assetsBefore: readonly PreparedAssetObservation[],
  assetsAfter: readonly PreparedAssetObservation[],
): void {
  assert.deepEqual(traces.integrityProblems, []);
  assert.ok(expected.requestSources.length > 0);
  for (const label of expected.fixedAssetLabels) {
    const before = assetsBefore.filter((asset) => asset.label === label);
    const after = assetsAfter.filter((asset) => asset.label === label);
    assert.equal(before.length, 1, `before fixture ${label}`);
    assert.equal(after.length, 1, `after fixture ${label}`);
    assert.equal(before[0]!.role, "fixture");
    assert.equal(after[0]!.role, "fixture");
    assert.equal(after[0]!.sha256, before[0]!.sha256);
    assert.equal(after[0]!.realPath, before[0]!.realPath);
    assert.deepEqual(after[0]!.identityBefore, before[0]!.identityAfter);
  }
  if (
    expected.digests.some(
      (item) => item.native === "present" && item.wire === "nonempty",
    )
  )
    assert.ok(
      expected.fixedAssetLabels.length > 0,
      "local digest equality requires fixed fixture observations",
    );
  const lookups = traces.writerObservations.filter(
    ({ observation: row }) =>
      row.writerPid === expected.writerPid &&
      row.event === "bridge-lookup" &&
      row.data?.bridge === expected.bridge &&
      row.data.root === expected.root &&
      JSON.stringify(row.data.sources) ===
        JSON.stringify(expected.lookupSources),
  );
  assert.equal(
    lookups.length,
    1,
    "one selected actual native lookup in this phase",
  );
  const lookup = lookups[0]!.observation;
  assert.equal(lookup.data?.nativeLookup, true);
  const paired = traces.writerObservations.filter(
    ({ observation: row }) =>
      row.writerPid === lookup.writerPid &&
      row.instance === lookup.instance &&
      row.invocation === lookup.invocation,
  );
  const one = (name: string) => {
    const rows = paired.filter(({ observation: row }) => row.event === name);
    assert.equal(rows.length, 1, `actual ${name}`);
    return rows[0]!.observation;
  };
  const request = one("bridge-request");
  assert.equal(request.data?.nativeLookup, true);
  assert.equal(request.data?.bridge, expected.bridge);
  assert.equal(request.data?.root, expected.root);
  assert.deepEqual(request.data?.sources, expected.requestSources);
  const misses = paired.filter(
    ({ observation: row }) => row.event === "bridge-cache-miss",
  );
  if (expected.bridge === "prisma") {
    assert.equal(lookup.data?.requestId, "schema");
    assert.equal(request.data?.requestId, "schema");
    assert.equal(misses.length, 1);
    assert.equal(
      paired.some(({ observation: row }) => row.event === "bridge-cache-hit"),
      false,
    );
  } else {
    assert.deepEqual(
      misses.map(({ observation: row }) => row.data?.source),
      expected.requestSources,
    );
  }
  const attempt = one("process-attempt");
  const process = one("process-result");
  const result = one("bridge-result");
  assert.ok(
    lookup.sequence < request.sequence &&
      request.sequence < attempt.sequence &&
      attempt.sequence < process.sequence &&
      process.sequence < result.sequence,
  );
  assert.equal(process.data?.bridge, expected.bridge);
  assert.ok(typeof process.pid === "number" && process.pid > 0);
  assert.equal(process.data?.started, true);
  assert.equal(process.data?.exitObserved, true);
  assert.equal(process.data?.status, 0);
  assert.equal(process.data?.error, "");
  assert.equal(process.data?.stdoutLimitExceeded, false);
  assert.equal(process.data?.stderrLimitExceeded, false);
  assert.equal(result.data?.nativeLookup, true);
  assert.equal(result.data?.runAttempted, true);
  assert.equal(result.data?.unmarshalOutcome, "succeeded");
  assert.equal(result.data?.unmarshalError, "");
  const capture = readE2eTracePayload(traceRoot, result, result.data?.stdout);
  const reply = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(capture.bytes),
  ) as {
    documents: Record<string, unknown>[];
    problems: Record<string, unknown>[];
  };
  assert.ok(Array.isArray(reply.documents) && Array.isArray(reply.problems));
  const key = expected.bridge === "prisma" ? "id" : "source";
  const documents = reply.documents.map((item) => item[key]);
  const problems = reply.problems.map((item) => item[key]);
  assert.deepEqual(documents, expected.documentIds);
  assert.deepEqual(problems, expected.problemIds);
  assert.deepEqual(result.data?.documentIds, expected.documentIds);
  assert.deepEqual(result.data?.problemIds, expected.problemIds);
  assert.equal(
    expected.digests.length,
    reply.documents.length + reply.problems.length,
  );
  assert.deepEqual(
    expected.digests.map((item) => item.id).sort(),
    [...expected.documentIds, ...expected.problemIds].sort(),
  );
  for (const oracle of expected.digests) {
    const items = [...reply.documents, ...reply.problems].filter(
      (item) => item[key] === oracle.id,
    );
    assert.equal(items.length, 1, `one raw digest owner ${oracle.id}`);
    const digest = items[0]!.digest;
    assert.equal(typeof digest, "string");
    if (oracle.wire === "empty") assert.equal(digest, "");
    else assert.match(digest as string, /^[a-f0-9]{64}$/);
    if (expected.bridge === "prisma") {
      assert.equal(oracle.id, "schema");
      assert.equal(oracle.native, "present");
      assert.equal(digest, lookup.data?.nativeDigest);
    } else {
      const native = lookup.data?.nativeDigests as Record<string, unknown>;
      assert.ok(native !== null && typeof native === "object");
      assert.equal(
        Object.hasOwn(native, oracle.id),
        oracle.native === "present",
      );
      if (oracle.native === "present") assert.equal(digest, native[oracle.id]);
    }
  }
}
