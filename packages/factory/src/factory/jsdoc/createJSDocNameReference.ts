import type {
  EntityName,
  JSDocMemberName,
  JSDocNameReference,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocNameReference}: a JSDoc reference to a declared name.
 *
 * The `name` is the referenced entity or member name. The printer emits that
 * name directly, with no surrounding decoration. This node is what tags such as
 * `@see` carry as their target.
 *
 * With a `Foo` name, the printer emits:
 *
 * ```ts
 * Foo;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The referenced name.
 * @returns The created {@link JSDocNameReference}.
 */
export const createJSDocNameReference = (
  name: EntityName | JSDocMemberName,
): JSDocNameReference =>
  make("JSDocNameReference", {
    name,
  });
