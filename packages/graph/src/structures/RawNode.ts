/**
 * Minimal native node facts consumed by the viewer reduction.
 *
 * @evidence contracts/common.md#principled-implementation Stable id and declaration coordinates preserve node identity; optional external/ignored flags permit older dumps without inventing provenance.
 * @evidence contracts/common.md#clear-and-simple-design The reducer accepts only the wire facts it needs rather than the complete MCP node model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Authored selection uses producer boundary flags instead of named consumer fixtures.
 * @evidence contracts/common.md#meaningful-documentation Native member comments document portable coordinates and optional producer flags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RawNode declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms RawNode declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work RawNode declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation RawNode declares a data shape or groups members and performs no filesystem, path or process operation.
 */
export interface RawNode {
  /** Position-invariant native identity or a published artifact address. */
  id: string;

  /** Producer's display name. */
  name: string;

  /** Native declaration or artifact category. */
  kind: string;

  /** Portable dump coordinate, or a legacy native path. */
  file: string;

  /** Dependency-boundary declaration when reported by the producer. */
  external?: boolean;

  /** Git-ignored generated source when reported by the producer. */
  ignored?: boolean;
}
