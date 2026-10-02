import type { Expression } from "../expressions/Expression";
import type { Statement } from "./Statement";

/**
 * A `with` statement.
 *
 * Built by {@link factory.createWithStatement}.
 *
 * @evidence contracts/common.md#principled-implementation Object Expression and body Statement preserve with syntax; its prohibition in strict code is not validated by this printable representation.
 * @evidence contracts/common.md#clear-and-simple-design Two fields separate the object operand and body using shared expression/statement nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The node describes source syntax without patching the runtime scope or foreign globals.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies with syntax and labels object/body roles; separated member prose follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface WithStatement {
  /** Discriminant tag; always `"WithStatement"`. */
  kind: "WithStatement";

  /** Object expression printed in the with header. */
  expression: Expression;

  /** Statement body executed under the with environment. */
  statement: Statement;
}
