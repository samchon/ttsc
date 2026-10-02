import type { Identifier } from "../../ast";
import { createIdentifier } from "./createIdentifier";

/**
 * Create a loop variable name as a plain {@link Identifier}.
 *
 * The legacy compiler uses a stateful name generator that allocates a fresh,
 * collision-free identifier. This package is stateless, so this is a simplified
 * placeholder: it does not track or guarantee uniqueness, it always returns an
 * identifier named `_i`.
 *
 * The `reservedInNestedScopes` parameter belongs to the stateful generator and
 * is accepted for signature parity but ignored. Because the name is fixed,
 * nested loops would collide, so the caller must rename as needed.
 *
 * With no arguments, this prints:
 *
 * ```ts
 * _i
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The documented stateless outline returns Identifier(_i), not the legacy
 *   compiler's scope-aware generated-name object. No freshness or nested-scope
 *   collision guarantee is established; callers must rename the placeholder.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The compatibility signature delegates name construction without introducing
 *   hidden allocator state or an unused scope model.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   _i is the explicitly documented placeholder, not proof of collision-free
 *   generation. The ignored reserve flag remains a semantic limitation.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs state the fixed name, ignored flag and nested-loop
 *   collision risk, separately from the example and acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param _reservedInNestedScopes Ignored; kept for signature parity.
 * @returns The created {@link Identifier}.
 */
export const createLoopVariable = (
  _reservedInNestedScopes?: boolean,
): Identifier => createIdentifier("_i");
