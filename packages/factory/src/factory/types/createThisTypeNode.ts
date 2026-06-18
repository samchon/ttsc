import type { ThisTypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ThisTypeNode}: the `this` type.
 *
 * It takes no inputs and the printer always emits the single keyword `this`,
 * the polymorphic this-type used in fluent method return positions and type
 * predicates.
 *
 * The printer renders:
 *
 * ```ts
 * this;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link ThisTypeNode}.
 */
export const createThisTypeNode = (): ThisTypeNode => make("ThisTypeNode", {});
