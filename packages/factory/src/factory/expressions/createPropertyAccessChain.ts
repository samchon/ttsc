import type {
  Expression,
  Identifier,
  PrivateIdentifier,
  PropertyAccessChain,
  Token,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link PropertyAccessChain}: a member access that participates in an
 * optional chain, such as `a?.b`.
 *
 * `expression` is the receiver and `name` is the accessed member; a string
 * `name` is wrapped in an identifier. `questionDotToken`, when present, makes
 * this link optional and prints as `?.`; when omitted the printer emits a plain
 * `.` while the node still carries chain context.
 *
 * With `expression` of `a`, a `?.` token, and `name` of `b`, the printer emits:
 *
 * ```ts
 * a?.b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The receiver expression.
 * @param questionDotToken The optional `?.` token, if this link is optional.
 * @param name The accessed member name.
 * @returns The created {@link PropertyAccessChain}.
 */
export const createPropertyAccessChain = (
  expression: Expression,
  questionDotToken: Token | undefined,
  name: string | Identifier | PrivateIdentifier,
): PropertyAccessChain =>
  make("PropertyAccessChain", {
    expression,
    questionDotToken,
    name: typeof name === "string" ? createIdentifier(name) : name,
  });
