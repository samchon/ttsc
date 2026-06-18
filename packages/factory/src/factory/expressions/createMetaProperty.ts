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
 * @author Jeongho Nam - https://github.com/samchon
 * @param keywordToken The leading keyword token (`NewKeyword` or
 *   `ImportKeyword`).
 * @param name The member name following the dot.
 * @returns The created {@link MetaProperty}.
 */
export const createMetaProperty = (
  keywordToken: SyntaxKind,
  name: string | Identifier,
): MetaProperty => make("MetaProperty", { keywordToken, name: asName(name) });
