/**
 * A run of plain text inside a JSDoc comment body.
 *
 * Built by {@link factory.createJSDocText}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocText {
  /** Discriminant tag; always `"JSDocText"`. */
  kind: "JSDocText";

  /** The textual content. */
  text: string;
}
