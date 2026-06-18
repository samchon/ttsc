import type { EntityName } from "../names/EntityName";
import type { TypeNode } from "./TypeNode";

/**
 * An import type, e.g. `import("mod").Type`.
 *
 * Built by {@link factory.createImportTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportTypeNode {
  /** Discriminant tag; always `"ImportTypeNode"`. */
  kind: "ImportTypeNode";

  /** Argument. */
  argument: TypeNode;

  /** Qualifier. */
  qualifier?: EntityName;

  /** TypeArguments. */
  typeArguments?: readonly TypeNode[];

  /** IsTypeOf. */
  isTypeOf: boolean;
}
