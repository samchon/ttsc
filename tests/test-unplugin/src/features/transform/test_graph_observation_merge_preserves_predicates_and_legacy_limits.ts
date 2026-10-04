import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { ITtscCompilerTransformation } from "ttsc";

import { graphInputObservationCompatible } from "../../../../../packages/unplugin/src/core/transform/envelope/graphInputObservationCompatible";
import { legacyProjectionOfGraphInputObservation } from "../../../../../packages/unplugin/src/core/transform/envelope/legacyProjectionOfGraphInputObservation";
import { mergeGraphInputObservations } from "../../../../../packages/unplugin/src/core/transform/envelope/mergeGraphInputObservations";
import { normalizeGraphInputObservation } from "../../../../../packages/unplugin/src/core/transform/envelope/normalizeGraphInputObservation";

/**
 * Verifies repeated graph observations combine only consistent predicates and
 * retain the weaker meaning of their legacy projection.
 *
 * Normalization precedes merging in the actual envelope owner. Empty listings
 * and failed reads do not establish absence; a legacy null is therefore a
 * lossy projection, never a replacement for replaying the original predicates.
 *
 * 1. Combine complementary file predicates and equal repeated observations.
 * 2. Reject conflicting duplicates, changed list order and cross-predicate
 *    contradictions while preserving consistent input records.
 * 3. Compare literal missing/readable/directory and unavailable projections.
 *
 * @evidence contracts/testing.md#behavioral-verification Directly calls normalization, mergeGraphInputObservations, graphInputObservationCompatible and legacyProjectionOfGraphInputObservation. Asserts all six repeated predicates agree or reject, complementary predicates merge, incompatible cross-fields reject and legacy encoding preserves exact supported outputs/failure kinds.
 * @evidence contracts/testing.md#independent-expectations Authored file/directory/missing facts, ordered entry lists, distinct literal hashes and absolute POSIX targets define equality/conflict expectations. Independent Node SHA-256 of the documented directory marker defines its legacy digest; expected classifications never use the projection or merger as an oracle.
 * @evidence contracts/testing.md#distinguishing-cases All six duplicate fields contrast equal and different values; equal normalized read-field order contrasts changed directory-list order. Empty lists/failed reads remain compatible unknowns, while successful reads, listings and stat/existence contradictions reject. Projection separates null-negative, readable, directory, missing realpath, missing content and unsupported observations; inputs remain unchanged.
 * @evidence contracts/testing.md#execution-ownership One source unit calls actual production operations in process on caller-owned normalized records, without native filesystem, compiler, observer, peer or session. No native identity/replay, envelope capture acquisition or process transport is certified by these predicate comparisons.
 */
export function test_graph_observation_merge_preserves_predicates_and_legacy_limits(): void {
  type Observation = ITtscCompilerTransformation.IInputObservation;
  const hash = "0".repeat(64);
  const otherHash = "1".repeat(64);
  const normalize = (value: unknown): Observation => {
    const actual = normalizeGraphInputObservation(value, "linux");
    assert.ok(actual, "the authored operand is a supported normalized observation");
    return actual;
  };
  const left = normalize({ fileExists: true, directoryExists: false, stat: "file" });
  const right = normalize({ readFile: { ok: true, hash }, realpath: { ok: true, path: "/physical/input.ts" } });
  const merged = mergeGraphInputObservations(left, right);
  assert.deepEqual(merged, {
    fileExists: true, directoryExists: false, stat: "file",
    readFile: { hash, ok: true }, realpath: { ok: true, path: "/physical/input.ts" },
  });
  assert.equal(graphInputObservationCompatible(merged!), true);
  assert.deepEqual(left, { fileExists: true, directoryExists: false, stat: "file" });
  assert.deepEqual(right, { readFile: { hash, ok: true }, realpath: { ok: true, path: "/physical/input.ts" } });

  const duplicates: [string, Observation, Observation][] = [
    ["fileExists", { fileExists: true }, { fileExists: false }],
    ["directoryExists", { directoryExists: true }, { directoryExists: false }],
    ["stat", { stat: "file" }, { stat: "directory" }],
    ["readFile", { readFile: { ok: true, hash } }, { readFile: { ok: true, hash: otherHash } }],
    ["realpath", { realpath: { ok: true, path: "/physical/a" } }, { realpath: { ok: true, path: "/physical/b" } }],
    ["accessibleEntries", { accessibleEntries: { directories: ["z", "a"], files: ["last", "first"] } },
      { accessibleEntries: { directories: ["a", "z"], files: ["last", "first"] } }],
  ];
  for (const [name, first, different] of duplicates) {
    const normalized = normalize(first);
    const identical = normalize(first);
    assert.deepEqual(mergeGraphInputObservations(normalized, identical), normalized, name + ": equal duplicate");
    assert.equal(mergeGraphInputObservations(normalized, normalize(different)), undefined, name + ": conflicting duplicate");
    assert.deepEqual(normalized, identical, name + ": merger leaves input unchanged");
  }
  assert.deepEqual(mergeGraphInputObservations(
    normalize({ readFile: { ok: true, hash } }),
    normalize({ readFile: { hash, ok: true } }),
  ), { readFile: { hash, ok: true } }, "normalization fixes property order before repeated comparisons");
  for (const [first, second] of [
    [{ fileExists: true }, { directoryExists: true }],
    [{ readFile: { ok: true, hash } }, { stat: "directory" }],
    [{ stat: "missing" }, { fileExists: true }],
    [{ accessibleEntries: { directories: ["child"], files: [] } }, { fileExists: true }],
  ] satisfies Array<[Observation, Observation]>) {
    assert.equal(mergeGraphInputObservations(normalize(first), normalize(second)), undefined);
    assert.equal(graphInputObservationCompatible({ ...first, ...second }), false);
  }
  const weak = { accessibleEntries: { directories: [], files: [] }, readFile: { ok: false as const } };
  assert.equal(graphInputObservationCompatible(weak), true);
  assert.deepEqual(mergeGraphInputObservations(normalize({ accessibleEntries: weak.accessibleEntries }),
    normalize({ readFile: weak.readFile })), weak);

  const directoryHash = createHash("sha256").update("ttsc:host-input:directory\0").digest("hex");
  const projections: [string, Observation, object][] = [
    ["known missing", { stat: "missing" }, { hash: null, realpath: null }],
    ["negative file predicate is lossy", { fileExists: false }, { hash: null, realpath: null }],
    ["failed read alone is lossy", { readFile: { ok: false } }, { hash: null, realpath: null }],
    ["readable file", { fileExists: true, readFile: { ok: true, hash }, realpath: { ok: true, path: "/physical/input.ts" } },
      { hash, realpath: "/physical/input.ts" }],
    ["directory", { stat: "directory", realpath: { ok: true, path: "/physical/types" } },
      { hash: directoryHash, realpath: "/physical/types" }],
    ["readable without identity", { readFile: { ok: true, hash }, realpath: { ok: false } }, { failure: "realpath-unavailable" }],
    ["directory without identity", { directoryExists: true }, { failure: "realpath-unavailable" }],
    ["file without content", { fileExists: true, readFile: { ok: false } }, { failure: "content-unavailable" }],
    ["empty listing alone", { accessibleEntries: { directories: [], files: [] } }, { failure: "unsupported-input-kind" }],
    ["identity alone", { realpath: { ok: true, path: "/physical/input.ts" } }, { failure: "unsupported-input-kind" }],
  ];
  for (const [name, observation, expected] of projections) {
    const normalized = normalize(observation);
    assert.equal(graphInputObservationCompatible(normalized), true, name);
    assert.deepEqual(legacyProjectionOfGraphInputObservation(normalized), expected, name);
  }
}
