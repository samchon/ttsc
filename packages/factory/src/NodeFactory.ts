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
 */
export type NodeFactory = typeof factory;
