import type { Identifier, MetaProperty } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link MetaProperty}: a meta-property reference like `new.target` or
 * `import.meta`.
 *
 * `keywordToken` selects the leading keyword (`NewKeyword` for `new.target`,
 * `ImportKeyword` for `import.meta`) and `name` is the member that follows the
 * dot. The printer emits the keyword, a dot, and the name with no surrounding
 * whitespace.
 *
 * With `keywordToken` of `NewKeyword` and `name` of `target`, the printer
 * emits:
 *
 * ```ts
 * new.target;
 * ```
 *
 * The builder does not validate keyword/name pairs or their enclosing context.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param keywordToken The leading keyword token (`NewKeyword` or
 *   `ImportKeyword`).
 * @param name The member name following the dot.
 * @returns The created {@link MetaProperty}.
 * @evidence contracts/common.md#principled-implementation Shared name normalization retains the supplied keyword and identifier pair; broad SyntaxKind and names require caller validity for import.meta or new.target in their supported contexts.
 * @evidence contracts/common.md#clear-and-simple-design One name adapter and make call capture the dotted form without inventing an expression receiver.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Keyword and member are explicit inputs, not patched import objects or guessed construction targets.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the normal pairs and lack of contextual validation; the direct expression example and parameter descriptions are separated from tags.
 */
export const createMetaProperty = (
  keywordToken: SyntaxKind,
  name: string | Identifier,
): MetaProperty => make("MetaProperty", { keywordToken, name: asName(name) });
