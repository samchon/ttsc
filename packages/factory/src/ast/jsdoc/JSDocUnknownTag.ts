import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * An otherwise-unrecognized JSDoc tag, e.g. `@customTag`.
 *
 * Built by {@link factory.createJSDocUnknownTag}.
 *
 * The printer emits the supplied name after `@` and any trailing description.
 * It does not reject a recognized name or interpret custom tag semantics.
 *
 * @evidence contracts/common.md#principled-implementation An arbitrary identifier and optional comment represent uninterpreted tag syntax; the unknown classification does not itself validate that a name is unrecognized.
 * @evidence contracts/common.md#clear-and-simple-design One general tag payload covers custom names without introducing a registry or payload fields for semantics the printer does not understand.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Custom tags use this public representation rather than consumer-specific cases added to the printer or foreign tag tables.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains exact-name emission and the absence of recognition or custom-semantic checks, with separated fields and paragraphs under the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocUnknownTag {
  /** Discriminant tag; always `"JSDocUnknownTag"`. */
  kind: "JSDocUnknownTag";

  /** The tag name. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
