import type {
  Identifier,
  NumericLiteral,
  PrivateIdentifier,
  StringLiteral,
} from "../../ast";
import { createStringLiteral } from "./createStringLiteral";

/**
 * Create a {@link StringLiteral} whose content is copied from an existing name
 * or literal node.
 *
 * The `sourceNode` may be an {@link Identifier}, a {@link PrivateIdentifier}, a
 * {@link StringLiteral}, or a {@link NumericLiteral}. Its `text` is read and
 * handed to {@link createStringLiteral}, so the result is double-quoted by
 * default and the quote-escaping rules of that factory apply.
 *
 * With a `sourceNode` identifier named `foo`, this prints:
 *
 * ```ts
 * "foo";
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param sourceNode The node to derive the text from.
 * @returns The created {@link StringLiteral}.
 */
export const createStringLiteralFromNode = (
  sourceNode: Identifier | PrivateIdentifier | StringLiteral | NumericLiteral,
): StringLiteral => createStringLiteral(sourceNode.text);
