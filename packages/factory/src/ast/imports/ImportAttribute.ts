import type { Expression } from "../expressions/Expression";
import type { ImportAttributeName } from "./ImportAttributeName";

/**
 * A single import attribute entry, e.g. `type: "json"`.
 *
 * Built by {@link factory.createImportAttribute}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportAttribute {
  /** Discriminant tag; always `"ImportAttribute"`. */
  kind: "ImportAttribute";

  /** The attribute name. */
  name: ImportAttributeName;

  /** The attribute value. */
  value: Expression;
}
