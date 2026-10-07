import type { ITtscCompilerTransformation } from "ttsc";

import { selectListedFiles } from "../envelope/selectListedFiles";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";

/**
 * Select host inputs that survive transform scratch disposal. Exception results
 * expose no host-input manifest. Native identity also excludes the temporary
 * wrapper even when its spelling aliases the reported path.
 *
 * @evidence contracts/common.md#principled-implementation Producer-listed host paths are normalized by selectListedFiles, then known scratch inputs and the temporary config's filesystem identity are removed because those artifacts are disposed before persistent validation.
 * @evidence contracts/common.md#clear-and-simple-design This selector owns persistence filtering; envelope decoding, scratch classification and native identity use shared helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exclusions identify actually disposed adapter-owned artifacts rather than unrelated dependencies or named fixture paths; an exception has no invented host manifest.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains exception and scratch lifetime semantics, while separated props document each optional exclusion boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Host identity uses the supplied filesystem capabilities and excludes aliases through identity keys instead of assuming lexical separators or case prove sameness.
 * @evidence contracts/performance.md#efficient-algorithms Valid host-list entries first incur native path resolution and full member checks. With no exclusions that fresh list returns directly; otherwise one context and one filter perform scratch/path text checks and cold native identity/ancestor/case observations as needed. The temporary baseline is computed once, but filtering can populate per-path identity storage; entry count alone does not bound text or native IO cost.
 * @evidence contracts/performance.md#reuse-equivalent-work One local identity context shares repeated path observations and the temporary-config identity is computed once; the returned mutable list is fresh rather than sharing caller mutation across requests.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This selector returns path values and owns no observer, descriptor or retained cache lifecycle; generation capture owns subsequent tracking.
 */
export function selectPersistentHostInputs(props: {
  /** Native operations used to compare reported aliases with scratch identities. */
  filesystem: TtscTransformFilesystemOperations;

  /** Native project directory anchoring envelope-relative host paths. */
  projectRoot: string;

  /** Compiler result whose valid host-input list is selected. */
  result: ITtscCompilerTransformation;

  /** Adapter-owned scratch tree removed when capture ends. */
  scratchDirectory?: string;

  /** Generated wrapper config, when capture materialized one. */
  temporaryTsconfig?: string;
}): string[] {
  if (props.result.type === "exception") return [];
  const inputs = selectListedFiles(props.projectRoot, props.result.hostInputs);
  if (
    props.scratchDirectory === undefined &&
    props.temporaryTsconfig === undefined
  )
    return inputs;
  const identities = createHostPathIdentityContext(props.filesystem);
  const temporary =
    props.temporaryTsconfig === undefined
      ? undefined
      : pathIdentityKey(props.temporaryTsconfig, identities);
  return inputs.filter((input) => {
    if (isTransformScratchInput(input, props.scratchDirectory)) return false;
    return pathIdentityKey(input, identities) !== temporary;
  });
}
