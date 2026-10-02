import { TtscGraphReadonly } from "../model/TtscGraphReadonly";
import { ITtscGraphNode as NodeShape } from "../structures/ITtscGraphNode";
type ITtscGraphNode = TtscGraphReadonly<NodeShape>;

/**
 * Exact resolved node, ambiguous candidates or an empty unknown outcome.
 *
 * @evidence contracts/common.md#principled-implementation Optional node and candidates preserve the resolver's unique, ambiguous and absent states without fabricating identity.
 * @evidence contracts/common.md#clear-and-simple-design One compact outcome is shared by direct-id, name and file-qualified resolution paths.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ranked candidates remain unresolved choices rather than a guessed definitive node.
 * @evidence contracts/common.md#meaningful-documentation Native member comments distinguish uniquely resolved identity from ranked ambiguity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface IResolvedGraphHandle {
  /** Present when the handle identifies exactly one node. */
  node?: ITtscGraphNode;

  /** Ranked remaining choices when more than one identity matches. */
  candidates?: ITtscGraphNode[];
}
