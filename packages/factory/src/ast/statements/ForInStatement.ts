import type { Expression } from "../expressions/Expression";
import type { ForInitializer } from "./ForInitializer";
import type { Statement } from "./Statement";

/**
 * A `for...in` statement.
 *
 * Built by {@link factory.createForInStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Initializer, enumerated expression and body preserve for-in operand roles; broad initializer forms do not establish legal assignment targets.
 * @evidence contracts/common.md#clear-and-simple-design Three named fields share existing loop initializer, expression and statement types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The enumeration source is caller syntax rather than a consumer-specific key list.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies for-in syntax and labels target, enumerated source and body; comments follow the documentation skill.
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
