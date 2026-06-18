/**
 * A stray `;` in a class body.
 *
 * Built by {@link factory.createSemicolonClassElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SemicolonClassElement {
  /** Discriminant tag; always `"SemicolonClassElement"`. */
  kind: "SemicolonClassElement";
}
