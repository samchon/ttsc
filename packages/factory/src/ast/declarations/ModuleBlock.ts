import type { Statement } from "../statements/Statement";

/**
 * The `{ ... }` body of a namespace / module.
 *
 * Built by {@link factory.createModuleBlock}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ModuleBlock {
  /** Discriminant tag; always `"ModuleBlock"`. */
  kind: "ModuleBlock";

  /** Statements. */
  statements: readonly Statement[];
}
