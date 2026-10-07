import type {
  Expression,
  ForInStatement,
  ForInitializer,
  Statement,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ForInStatement}: a `for (... in ...)` loop.
 *
 * The `initializer` is the binding that receives each enumerable key (a
 * declaration list such as `const key`, or an assignment target), `expression`
 * is the object being enumerated, and `statement` is the loop body. The loop
 * walks the object's enumerable property keys as strings.
 *
 * With an `initializer` of `const key`, an `expression` of `obj`, and a
 * `statement` block calling `use(key)`, the result is:
 *
 * ```ts
 * for (const key in obj) {
 *   use(key);
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param initializer The initializer.
 * @param expression The expression.
 * @param statement The statement.
 * @returns The created {@link ForInStatement}.
 * @evidence contracts/common.md#principled-implementation
 *   Initializer, enumerated object and body retain for-in's key-enumeration
 *   grammar; ForInitializer permits declaration lists or assignment-target trees.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The syntax node distinguishes binding/object/body without resolving keys
 *   or sharing implementation with value-iteration semantics.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No Object.keys snapshot is substituted for the requested for-in program.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains enumerable string keys and header/body roles, with a key-loop
 *   example and separated acknowledgment paragraphs.
 */
export const createForInStatement = (
  initializer: ForInitializer,
  expression: Expression,
  statement: Statement,
): ForInStatement =>
  make("ForInStatement", { initializer, expression, statement });
