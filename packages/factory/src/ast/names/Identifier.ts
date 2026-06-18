/**
 * An identifier — a name such as a variable, type, property, or keyword
 * reference.
 *
 * Built by {@link factory.createIdentifier}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface Identifier {
  /** Discriminant tag; always `"Identifier"`. */
  kind: "Identifier";

  /** The identifier text. */
  text: string;
}
