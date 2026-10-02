import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc function type, e.g. `function(string): number`.
 *
 * Built by {@link factory.createJSDocFunctionType}.
 *
 * Parameter order is preserved. An absent return type omits the colon and
 * return annotation. Parameter nodes are printed as supplied, without checking
 * whether their TypeScript syntax is accepted by a JSDoc consumer.
 *
 * @evidence contracts/common.md#principled-implementation An ordered parameter sequence and optional return type express the printer's function-form payload; broad ParameterDeclaration inputs remain printable data rather than validated JSDoc signatures.
 * @evidence contracts/common.md#clear-and-simple-design Parameters and return annotation are the two signature roles, with omission represented directly instead of a separate return-presence flag.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Signature components stay caller-supplied nodes without substituting known parameter lists or modifying a foreign type checker.
 * @evidence contracts/common.md#meaningful-documentation Native prose states ordering, absent-return output and the contextual syntax limitation; member and paragraph separation follows the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocFunctionType {
  /** Discriminant tag; always `"JSDocFunctionType"`. */
  kind: "JSDocFunctionType";

  /** Parameters emitted in order inside the function parentheses. */
  parameters: readonly ParameterDeclaration[];

  /** Return annotation; omission suppresses both the colon and type. */
  type?: TypeNode;
}
