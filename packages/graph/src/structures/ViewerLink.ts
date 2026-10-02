/**
 * Viewer edge joining two retained display identities.
 *
 * @evidence contracts/common.md#principled-implementation Source and target use the node rewrite policy while kind groups native relationships into supported visual families.
 * @evidence contracts/common.md#clear-and-simple-design The display relation carries only endpoints and color-family category.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown relationship kinds pass through rather than being relabeled as a known family.
 * @evidence contracts/common.md#meaningful-documentation Native members describe rewritten endpoints and display-family kind.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ViewerLink declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ViewerLink declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ViewerLink declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ViewerLink declares a data shape or groups members and performs no filesystem, path or process operation.
 */
export interface ViewerLink {
  /** Retained source viewer node id. */
  source: string;

  /** Retained target viewer node id. */
  target: string;

  /** Grouped display family, or an unchanged unknown native kind. */
  kind: string;
}
