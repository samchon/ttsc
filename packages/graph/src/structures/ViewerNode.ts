/**
 * Connected viewer node with its degree in the final displayed subgraph.
 *
 * @evidence contracts/common.md#principled-implementation Rewritten identity and file coordinates remain paired; degree counts only final visible incident edges.
 * @evidence contracts/common.md#clear-and-simple-design One compact display record omits native provenance and source spans unnecessary for drawing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Name is presentation, not a substitute identity that could merge distinct declarations.
 * @evidence contracts/common.md#meaningful-documentation Native members identify display coordinates and final-subgraph degree.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ViewerNode declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ViewerNode declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ViewerNode declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ViewerNode declares a data shape or groups members and performs no filesystem, path or process operation.
 */
export interface ViewerNode {
  /** Identity rewritten with the same path policy as incident edges. */
  id: string;

  /** Producer declaration display name. */
  name: string;

  /** Node category used for viewer colors. */
  kind: string;

  /** Display path after optional legacy rerooting. */
  file: string;

  /** Incident edge count after final node selection. */
  degree: number;
}
