import type { Expression } from "../expressions/Expression";

/**
 * A `require("...")` reference of an import-equals declaration.
 *
 * Built by {@link factory.createExternalModuleReference}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ExternalModuleReference {
  /** Discriminant tag; always `"ExternalModuleReference"`. */
  kind: "ExternalModuleReference";

  /** Expression. */
  expression: Expression;
}
