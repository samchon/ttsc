import type * as factory from "./factory/index";

/**
 * Outline of the legacy `ts.NodeFactory`, using this package's builders.
 *
 * The namespace shape follows the actual exported builder functions, so adding
 * a builder extends this type without a second manually maintained signature.
 *
 * @evidence contracts/common.md#principled-implementation The typeof namespace query derives the factory value's complete builder signatures, preserving their actual parameter and result types without asserting legacy APIs this package does not implement.
 * @evidence contracts/common.md#clear-and-simple-design A single type query expresses the public namespace shape; the public barrel re-exports this defining declaration without duplicating its signatures.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation reflects actual builders rather than consumer-specific signatures or a patched external compiler namespace.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the outline compatibility boundary and explains why signatures track exported builders, with separate paragraphs before tags as required by the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 */
export type NodeFactory = typeof factory;
