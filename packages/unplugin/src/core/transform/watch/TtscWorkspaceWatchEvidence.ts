import type { ITtscCompilerTransformation } from "ttsc";

/**
 * Native workspace evidence attached independently of a compiler input codec.
 *
 * @evidence contracts/common.md#principled-implementation Preserves the producer's metadata and delivery requirements at a usable watch spelling.
 * @evidence contracts/common.md#clear-and-simple-design Attaches workspace observations to a path independently of its compiler state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A workspace witness cannot masquerade as a compiler file, tree or predicate codec.
 * @evidence contracts/common.md#meaningful-documentation Describes how this evidence coexists with the input codec.
 * @evidence contracts/portability.md#os-neutral-implementation Witness keys keep the original native spelling, including encoded POSIX bytes.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The type declares a carrier with no runtime computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The observer owns condition reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The type allocates no resource.
 */
export type TtscWorkspaceWatchEvidence = NonNullable<
  ITtscCompilerTransformation.ISuccess["workspaceInputs"]
>[string];
