import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscGenerationProofFailure } from "./TtscGenerationProofFailure";

/**
 * Index one native snapshot's recorded inputs for streaming freshness
 * classification. The diagnostic witness limit must not decide whether a
 * compilation is coherent, so compatibility is decided before diagnostic
 * truncation and remains refused after the first incompatible occurrence.
 *
 * @evidence contracts/common.md#principled-implementation Only explicit freshness changes to recorded compiler inputs or project discovery qualify; changed configuration selection and conflicting host/compiler reads do not; missing and contradictory producer evidence stays outside this class.
 * @evidence contracts/common.md#clear-and-simple-design One generation-owned classifier is shared by its proof collectors and final delivery admission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No failure is ignored because its printable witness exceeded the diagnostic limit; unknown kinds and unrecorded plugin inputs remain refusals.
 * @evidence contracts/common.md#meaningful-documentation Prose explains streaming classification, diagnostic truncation and generation ownership.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve anchors protocol input names without guessing physical identity or case behavior.
 * @evidence contracts/performance.md#efficient-algorithms Compiler observation and host hash indexes cost recorded path bytes and input counts; each failure uses a kind check and indexed lexical lookup.
 * @evidence contracts/performance.md#reuse-equivalent-work Every collector for this generation borrows the same classifier and recorded-input index; another generation constructs its own view.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The generation owns its path index and closure until eviction or disposal releases the generation; retained paths follow the reported input population with no separate handle.
 */
export function compilerSnapshotFailureClassifier(
  result: ITtscCompilerTransformation,
  projectRoot: string,
): ((failure: TtscGenerationProofFailure) => boolean) | undefined {
  if (result.type !== "success" || !result.graph?.compilationSnapshot)
    return undefined;
  const recorded = new Map(
    Object.entries(result.graph.inputObservations ?? {}).map(
      ([file, observation]) => [path.resolve(projectRoot, file), observation],
    ),
  );
  const hostHashes = new Map(
    Object.entries(result.hostInputHashes ?? {}).map(([file, hash]) => [
      path.resolve(projectRoot, file),
      hash,
    ]),
  );
  const freshnessKinds = new Set([
    "content-changed",
    "realpath-changed",
    "graph-content-changed",
    "graph-realpath-changed",
    "accessible-entries-changed",
    "file-exists-changed",
    "directory-exists-changed",
    "stat-changed",
    "read-file-changed",
    "native-file-changed",
    "native-directory-changed",
    "native-entry-changed",
    "native-optional-file-changed",
    "input-content-changed",
    "input-metadata-changed",
    "directory-membership-changed",
    "directory-changed-during-walk",
    "file-changed-during-read",
    "project-membership-event",
    "membership-policy-learned",
    "snapshot-mismatch",
    "changed-during-validation",
  ]);
  return (failure) => {
    if (!freshnessKinds.has(failure.kind)) return false;
    if (failure.domain === "project") return true;
    if (failure.path === undefined) return false;
    const file = path.resolve(failure.path);
    const observation = recorded.get(file);
    if (observation === undefined) return false;
    // A descriptor/host read must agree with the compiler's captured text.
    // Merely sharing a path cannot make two different evaluation epochs coherent.
    if (failure.domain === "host" && hostHashes.has(file)) {
      const read = observation.readFile;
      return (
        read !== undefined &&
        hostHashes.get(file) === (read.ok ? read.hash : null)
      );
    }
    return true;
  };
}
