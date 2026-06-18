import type { EntityName, Identifier, JSDocMemberName } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocMemberName}: a JSDoc `#`-joined member reference.
 *
 * The `left` is the owning name and `right` is the member. The printer joins
 * them with a `#`, the JSDoc separator for an instance member.
 *
 * With a left of `Foo` and a right of `bar`, the printer emits:
 *
 * ```ts
 * Foo#bar
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand side.
 * @param right The right-hand side.
 * @returns The created {@link JSDocMemberName}.
 */
export const createJSDocMemberName = (
  left: EntityName | JSDocMemberName,
  right: Identifier,
): JSDocMemberName =>
  make("JSDocMemberName", {
    left,
    right,
  });
