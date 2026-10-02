/**
 * Connected viewer node with its degree in the final displayed subgraph.
 *
 * @evidence contracts/common.md#principled-implementation Rewritten identity and file coordinates remain paired; degree counts only final visible incident edges.
 * @evidence contracts/common.md#clear-and-simple-design One compact display record omits native provenance and source spans unnecessary for drawing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Name is presentation, not a substitute identity that could merge distinct declarations.
 * @evidence contracts/common.md#meaningful-documentation Native members identify display coordinates and final-subgraph degree.
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
