import type { ITtscCompilerTransformation } from "ttsc";

import { resultFilesystem } from "../cache/resultFilesystem";
import { matchesNativeCompilerSnapshotFilesystem } from "../filesystem/matchesNativeCompilerSnapshotFilesystem";
import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";
import { compilerSnapshotFailureClassifier } from "./compilerSnapshotFailureClassifier";

/**
 * Separate a coherent local compiler result from proof that disk still matches
 * it. Only recorded compiler inputs and project changes may lose freshness;
 * missing, contradictory or unobserved producer inputs remain refusals. Adopted
 * results must be current on this worker before they can be delivered. The
 * consumer must retain the native input view; a substituted filesystem cannot
 * classify its disagreement with the compiler as a physical source edit.
 *
 * @evidence contracts/common.md#principled-implementation A native shared snapshot ID, matching native consumer input capabilities, internally consistent graph and complete host observation establish current-generation authority; only explicit freshness changes covered by that graph can bypass stabilization.
 * @evidence contracts/common.md#clear-and-simple-design One admission predicate separates delivery from existing cache/publication validation without weakening those validators.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown failure kinds, incomplete reports, foreign adoptions and producer conflicts cannot become a successful snapshot delivery.
 * @evidence contracts/common.md#meaningful-documentation Prose distinguishes local authority, disk freshness and adopted-worker requirements.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve maps compiler-relative proof keys to their project anchor; the consumer gate compares actual native input capabilities and explicit path grammar; this predicate infers no case or physical identity from OS names.
 * @evidence contracts/performance.md#efficient-algorithms A fixed native capability comparison establishes the observing view before any summary is trusted. A captured streaming summary then answers without another scan; legacy caller aggregates with no omissions use one recorded-input classifier and a bounded witness scan. Native disk inputs are not reread.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Delivery permission does not grant cache or publication reuse and is recomputed for each captured result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Call-local indexes retain no handle or generation history.
 */
export function canDeliverCompilerSnapshot(props: {
  result: ITtscCompilerTransformation;
  projectRoot: string;
  failures: TtscGenerationProofFailures;
  adopted: boolean;
}): boolean {
  const { result, failures } = props;
  if (
    props.adopted ||
    result.type !== "success" ||
    !result.graph?.compilationSnapshot ||
    !matchesNativeCompilerSnapshotFilesystem(resultFilesystem(result)) ||
    result.observationsComplete === false ||
    Object.keys(result.hostInputProofFailures ?? {}).length !== 0 ||
    Object.keys(result.graph.inputProofFailures ?? {}).length !== 0 ||
    failures.entries.length === 0
  )
    return false;
  if (failures.snapshotCompatible !== undefined)
    return failures.snapshotCompatible;
  const classify = compilerSnapshotFailureClassifier(
    result,
    props.projectRoot,
  )!;
  return failures.omitted === 0 && failures.entries.every(classify);
}
