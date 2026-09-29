import type { ImportAttributes } from "../imports/ImportAttributes";
import type { EntityName } from "../names/EntityName";
import type { TypeNode } from "./TypeNode";

/**
 * An import type, e.g. `import("mod").Type`.
 *
 * Built by {@link factory.createImportTypeNode}.
 *
 * The argument should be a module string literal type. Its broad TypeNode
 * representation does not check that restriction or resolve a module.
 *
 * @evidence contracts/common.md#principled-implementation The argument, optional attributes/qualification/generics and typeof flag preserve import-type parts; broad argument validity and module resolution remain caller responsibilities.
 * @evidence contracts/common.md#clear-and-simple-design Each import-type suffix or prefix has one field, reusing EntityName and ImportAttributes representations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No module names are embedded; the typeof flag is a syntax distinction rather than a compatibility workaround.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states the argument restriction and member comments explain absent suffixes; separated paragraphs follow the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportTypeNode {
  /** Discriminant tag; always `"ImportTypeNode"`. */
  kind: "ImportTypeNode";

  /** Module operand inside import(...), normally a string literal type. */
  argument: TypeNode;

  /** The `with { … }` import attributes, if any. */
  attributes?: ImportAttributes;

  /** Dotted name selected from the module; omitted for the whole import type. */
  qualifier?: EntityName;

  /** Generic arguments applied to the qualified name, if present. */
  typeArguments?: readonly TypeNode[];

  /** Whether typeof precedes the import expression. */
  isTypeOf: boolean;
}
