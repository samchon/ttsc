import type { Expression, ExternalModuleReference } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ExternalModuleReference}: a `require("...")` reference.
 *
 * This is the right-hand side of an `import x = require(...)` statement. The
 * `expression` is the module specifier, normally a string literal, which the
 * printer wraps in `require(...)`.
 *
 * Given a string literal of `"./app"`, the printed reference is:
 *
 * ```ts
 * require("./app");
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ExternalModuleReference}.
 */
export const createExternalModuleReference = (
  expression: Expression,
): ExternalModuleReference => make("ExternalModuleReference", { expression });
