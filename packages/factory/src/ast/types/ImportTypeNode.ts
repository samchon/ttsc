import type { ImportAttributes } from "../imports/ImportAttributes";
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

  /** The `with { … }` import attributes, if any. */
  attributes?: ImportAttributes;

  /** Qualifier. */
  qualifier?: EntityName;

  /** TypeArguments. */
  typeArguments?: readonly TypeNode[];

  /** IsTypeOf. */
  isTypeOf: boolean;
}
