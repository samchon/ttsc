/**
 * Viewer edge joining two retained display identities.
 *
 * @evidence contracts/common.md#principled-implementation Source and target use the node rewrite policy while kind groups native relationships into supported visual families.
 * @evidence contracts/common.md#clear-and-simple-design The display relation carries only endpoints and color-family category.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown relationship kinds pass through rather than being relabeled as a known family.
 * @evidence contracts/common.md#meaningful-documentation Native members describe rewritten endpoints and display-family kind.
 */
export interface ViewerLink {
  /** Retained source viewer node id. */
  source: string;

  /** Retained target viewer node id. */
  target: string;

  /** Grouped display family, or an unchanged unknown native kind. */
  kind: string;
}
