/**
 * One module node inside a Vite module graph; opaque to this module.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Object identity is sufficient because Vite owns node contents and accepts
 *   these same objects back for invalidation or reload.
 * @evidence contracts/common.md#clear-and-simple-design
 *   An opaque object avoids duplicating graph internals this adapter never reads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No foreign graph fields are assumed or mutated through this representation.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose names graph membership and opacity; tags follow a blank
 *   description separator as documentation guidance requires.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   ViteModuleNodeLike only declares a shape; it has no filesystem, path or
 *   process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   ViteModuleNodeLike only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   ViteModuleNodeLike only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   ViteModuleNodeLike only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export type ViteModuleNodeLike = object;
