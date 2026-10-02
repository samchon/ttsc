import type { Identifier, NamedTupleMember, Token, TypeNode } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link NamedTupleMember}: a labeled tuple element such as `name:
 * string`.
 *
 * A leading `...` prints when the rest token is present, then the label, then a
 * `?` when the question token is present, then `: ` followed by the type. A
 * string name is normalized to an identifier.
 *
 * Given the label `name` and a `string` type, the printer renders:
 *
 * ```ts
 * name: string
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The label becomes an Identifier while rest, optionality and element type
 *   remain independent fields. Tuple-position legality is a caller responsibility.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One labeled element retains its markers without creating a variable
 *   declaration or duplicating tuple-list ordering in the factory.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Labels and marker combinations are not rewritten from expected tuple
 *   output; the supplied type remains the element's actual child.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the named tuple element and marker order, using the element
 *   itself rather than an unrelated statement as the example.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param dotDotDotToken The rest marker (`...`), if any.
 * @param name The element label.
 * @param questionToken The optional marker (`?`), if any.
 * @param type The element type.
 * @returns The created {@link NamedTupleMember}.
 */
export const createNamedTupleMember = (
  dotDotDotToken: Token | undefined,
  name: string | Identifier,
  questionToken: Token | undefined,
  type: TypeNode,
): NamedTupleMember =>
  make("NamedTupleMember", {
    dotDotDotToken,
    name: asName(name),
    questionToken,
    type,
  });
