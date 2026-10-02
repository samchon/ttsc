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
 * "foo"
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Each accepted name/literal node carries text. Passing that text to
 *   createStringLiteral preserves content while using its default quoting.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This adapter extracts one common field and delegates literal construction;
 *   it does not duplicate quote policy for four source-node variants.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Supported source variants come from their text-bearing AST interfaces;
 *   no source-node identity is used to choose a fabricated string.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc identifies accepted variants, text copying and default quotes,
 *   with a separate example and tags following documentation paragraph rules.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param sourceNode The node to derive the text from.
 * @returns The created {@link StringLiteral}.
 */
export const createStringLiteralFromNode = (
  sourceNode: Identifier | PrivateIdentifier | StringLiteral | NumericLiteral,
): StringLiteral => createStringLiteral(sourceNode.text);
