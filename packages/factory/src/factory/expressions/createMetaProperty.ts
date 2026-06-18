import type { Identifier, MetaProperty } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link MetaProperty}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param keywordToken The keywordToken.
 * @param name The name.
 * @returns The created node.
 */
export const createMetaProperty = (
  keywordToken: SyntaxKind,
  name: string | Identifier,
): MetaProperty => make("MetaProperty", { keywordToken, name: asName(name) });
