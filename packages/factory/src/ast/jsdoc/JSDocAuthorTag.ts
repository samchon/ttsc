import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * An `@author` JSDoc tag.
 *
 * Built by {@link factory.createJSDocAuthorTag}.
 *
 * Author information lives in the optional description. Omitting it emits only
 * the supplied tag name; the node does not resolve an author identity.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The tag identifier and optional description express author-tag syntax without imposing a structured identity format or asserting identity resolution.
 * @evidence contracts/common.md#clear-and-simple-design Author text uses the shared comment representation, avoiding an unused person registry or fields the printer cannot interpret.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Authors are supplied as data; neither a known author's name nor an external identity lookup substitutes for that description.
 * @evidence contracts/common.md#meaningful-documentation Native prose states where author information belongs and what omission emits, with separated paragraphs and members following the documentation guidance.
 */
export interface JSDocAuthorTag {
  /** Discriminant tag; always `"JSDocAuthorTag"`. */
  kind: "JSDocAuthorTag";

  /** The tag name, e.g. `author`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
