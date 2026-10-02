import type { BindingName } from "../expressions/BindingName";
import type { Expression } from "../expressions/Expression";
import type { Token } from "../names/Token";
import type { TypeNode } from "../types/TypeNode";

/**
 * A single binding inside a variable declaration list.
 *
 * Built by {@link factory.createVariableDeclaration}.
 *
 * @evidence contracts/common.md#principled-implementation BindingName permits identifiers and destructuring with optional assignment marker, type and initializer; those broad combinations are not semantic declaration validation.
 * @evidence contracts/common.md#clear-and-simple-design Name, marker, annotation and initializer each have one field using shared syntax nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Bindings and values come from callers, without fixture-specific variable substitutions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies a declaration-list binding and documents destructuring and omitted clauses; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface VariableDeclaration {
  /** Discriminant tag; always `"VariableDeclaration"`. */
  kind: "VariableDeclaration";

  /** The name; a {@link BindingName} allows array / object destructuring. */
  name: BindingName;

  /** The definite-assignment marker (`!`), if any. */
  exclamationToken?: Token;

  /** Variable annotation, if explicitly supplied. */
  type?: TypeNode;

  /** The initializer, if any. */
  initializer?: Expression;
}
