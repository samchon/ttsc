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
 * require("./app")
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The expression is retained as the module-reference operand; the printer
 *   supplies require parentheses for an import-equals reference.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Reference syntax is distinct from the local import binding, owned by
 *   ImportEqualsDeclaration; this builder performs no actual module loading.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   require is the source-form contract, not an injected runtime resolver.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states import-equals placement and the usual string operand,
 *   with a bare-reference example and separated acknowledgment tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ExternalModuleReference}.
 */
export const createExternalModuleReference = (
  expression: Expression,
): ExternalModuleReference => make("ExternalModuleReference", { expression });
