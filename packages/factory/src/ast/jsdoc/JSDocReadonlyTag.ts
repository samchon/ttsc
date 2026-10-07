import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@readonly` JSDoc tag.
 *
 * Built by {@link factory.createJSDocReadonlyTag}.
 *
 * This is a documentation marker. It does not freeze a value or add a readonly
 * modifier to a declaration; omitting prose leaves a bare tag.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A readonly-tag kind and optional description express the annotation while keeping printed mutability intent distinct from language or runtime enforcement.
 * @evidence contracts/common.md#clear-and-simple-design The marker needs no target storage or mutation policy; the tag identifier and description are the complete printed payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Readonly intent is explicit annotation data rather than freezing caller objects or replacing foreign setters.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the absence of freezing or modifier insertion and the bare-tag case; paragraphs and members follow the documentation guidance.
 */
export interface JSDocReadonlyTag {
  /** Discriminant tag; always `"JSDocReadonlyTag"`. */
  kind: "JSDocReadonlyTag";

  /** The tag name, e.g. `readonly`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
