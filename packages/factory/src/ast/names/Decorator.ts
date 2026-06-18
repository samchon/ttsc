import type { Expression } from "../expressions/Expression";

/**
 * A decorator applied to a declaration, e.g. `@Component`.
 *
 * Built by {@link factory.createDecorator}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface Decorator {
  /** Discriminant tag; always `"Decorator"`. */
  kind: "Decorator";

  /** The decorator expression (after the `@`). */
  expression: Expression;
}
