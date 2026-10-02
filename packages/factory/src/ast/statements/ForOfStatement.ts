import type { Expression } from "../expressions/Expression";
import type { Token } from "../names/Token";
import type { ForInitializer } from "./ForInitializer";
import type { Statement } from "./Statement";

/**
 * A `for...of` statement (optionally `for await`).
 *
 * Built by {@link factory.createForOfStatement}.
 *
 * @evidence contracts/common.md#principled-implementation Binding, iterable expression, body and optional await presence preserve for-of parts; iteration and async-context validity are not checked by the shape.
 * @evidence contracts/common.md#clear-and-simple-design Named fields expose the loop's operands and optional prefix using existing shared nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Await presence expresses syntax, not a retry or runtime compatibility compensation.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies for-await and documents absent await, binding and iterable roles; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ForOfStatement {
  /** Discriminant tag; always `"ForOfStatement"`. */
  kind: "ForOfStatement";

  /** Presence of await before the header; omitted for synchronous iteration. */
  awaitModifier?: Token;

  /** Binding or assignment target before of. */
  initializer: ForInitializer;

  /** Iterable expression following of. */
  expression: Expression;

  /** Loop body. */
  statement: Statement;
}
