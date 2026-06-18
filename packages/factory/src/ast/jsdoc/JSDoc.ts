import type { JSDocComment } from "./JSDocComment";
import type { JSDocTag } from "./JSDocTag";

/**
 * A full JSDoc comment block, e.g. `/** ... *\/`.
 *
 * Built by {@link factory.createJSDocComment}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDoc {
  /** Discriminant tag; always `"JSDoc"`. */
  kind: "JSDoc";

  /** The leading comment text, if any. */
  comment?: string | readonly JSDocComment[];

  /** The tags, if any. */
  tags?: readonly JSDocTag[];
}
