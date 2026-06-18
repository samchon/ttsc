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
 * _i;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param _reservedInNestedScopes Ignored; kept for signature parity.
 * @returns The created {@link Identifier}.
 */
export const createLoopVariable = (
  _reservedInNestedScopes?: boolean,
): Identifier => createIdentifier("_i");
