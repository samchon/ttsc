import type { JSDocPropertyTag } from "./JSDocPropertyTag";

/**
 * A JSDoc type literal — an object type expressed through `@property` tags.
 *
 * Built by {@link factory.createJSDocTypeLiteral}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocTypeLiteral {
  /** Discriminant tag; always `"JSDocTypeLiteral"`. */
  kind: "JSDocTypeLiteral";

  /** The member `@property` tags, if any. */
  jsDocPropertyTags?: readonly JSDocPropertyTag[];

  /** If true, this literal represents an _array_ of its type. */
  isArrayType: boolean;
}
