import type { ObjectLiteralElement } from "./ObjectLiteralElement";

/**
 * An object literal, e.g. `{ a: 1 }`.
 *
 * Built by {@link factory.createObjectLiteralExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ObjectLiteralExpression {
  /** Discriminant tag; always `"ObjectLiteralExpression"`. */
  kind: "ObjectLiteralExpression";

  /** The properties. */
  properties: readonly ObjectLiteralElement[];

  /** When `true`, print one entry per line. */
  multiLine?: boolean;
}
