import type { TypeElement, TypeLiteralNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TypeLiteralNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param members The members.
 * @returns The created {@link TypeLiteralNode}.
 */
export const createTypeLiteralNode = (
  members: readonly TypeElement[] = [],
): TypeLiteralNode => make("TypeLiteralNode", { members });
