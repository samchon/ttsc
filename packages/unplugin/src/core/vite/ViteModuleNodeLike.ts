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
 */
export type ViteModuleNodeLike = object;
