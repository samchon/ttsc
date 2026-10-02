/**
 * Minimal native node facts consumed by the viewer reduction.
 *
 * @evidence contracts/common.md#principled-implementation Stable id and declaration coordinates preserve node identity; optional external/ignored flags permit older dumps without inventing provenance.
 * @evidence contracts/common.md#clear-and-simple-design The reducer accepts only the wire facts it needs rather than the complete MCP node model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Authored selection uses producer boundary flags instead of named consumer fixtures.
 * @evidence contracts/common.md#meaningful-documentation Native member comments document portable coordinates and optional producer flags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
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
