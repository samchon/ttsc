import type { RestTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link RestTypeNode}: a `...T` rest element inside a tuple type.
 *
 * A leading `...` prints in front of the type. This form is only valid in tuple
 * element position, for example `[string, ...number[]]`.
 *
 * Given a `string[]` element type, the printer renders:
 *
 * ```ts
 * ...string[]
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The rest element type.
 * @returns The created {@link RestTypeNode}.
 */
export const createRestTypeNode = (type: TypeNode): RestTypeNode =>
  make("RestTypeNode", { type });
