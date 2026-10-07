import type { Token } from "../names/Token";
import type { TypeElement } from "./TypeElement";
import type { TypeNode } from "./TypeNode";
import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * A mapped type, e.g. `{ [K in keys]: T }`.
 *
 * Built by {@link factory.createMappedTypeNode}.
 *
 * Optional markers represent readonly and optionality modifiers, with + or -
 * tokens adding or removing them. Additional members follow the mapped member;
 * ordinary TypeScript grammar rejects such extra declarations, so callers must
 * choose whether that source representation is appropriate.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The mapped parameter, optional key remapping and value annotation retain mapped-type operands; additional members retain source data without asserting that TypeScript accepts their combination.
 * @evidence contracts/common.md#clear-and-simple-design Distinct fields separate key iteration, remapping, value and modifier presence without storing evaluated mappings.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Key and value types are supplied syntax, with no consumer-specific mapped results or foreign mutation.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains modifier tokens and the grammar limitation of additional members; member comments and paragraphs follow the documentation skill.
 */
export interface MappedTypeNode {
  /** Discriminant tag; always `"MappedTypeNode"`. */
  kind: "MappedTypeNode";

  /**
   * Readonly, + or - token controlling the readonly modifier; absent means no
   * modifier.
   */
  readonlyToken?: Token;

  /** Iteration variable whose constraint supplies the keys after in. */
  typeParameter: TypeParameterDeclaration;

  /** Key remapping type after as, if present. */
  nameType?: TypeNode;

  /** ?, + or - token controlling optionality; absent means no modifier. */
  questionToken?: Token;

  /** Mapped value annotation; omitted when no annotation is supplied. */
  type?: TypeNode;

  /**
   * Additional members after the mapped member; ordinary TypeScript grammar
   * rejects such extra declarations.
   */
  members?: readonly TypeElement[];
}
