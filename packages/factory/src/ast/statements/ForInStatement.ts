import type { Expression } from "../expressions/Expression";
import type { ForInitializer } from "./ForInitializer";
import type { Statement } from "./Statement";

/**
 * A `for...in` statement.
 *
 * Built by {@link factory.createForInStatement}.
 *
 * @evidence contracts/common.md#principled-implementation Initializer, enumerated expression and body preserve for-in operand roles; broad initializer forms do not establish legal assignment targets.
 * @evidence contracts/common.md#clear-and-simple-design Three named fields share existing loop initializer, expression and statement types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The enumeration source is caller syntax rather than a consumer-specific key list.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies for-in syntax and labels target, enumerated source and body; comments follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ForInStatement {
  /** Discriminant tag; always `"ForInStatement"`. */
  kind: "ForInStatement";

  /** Binding or assignment target before in. */
  initializer: ForInitializer;

  /** Object expression whose keys are enumerated. */
  expression: Expression;

  /** Loop body. */
  statement: Statement;
}
