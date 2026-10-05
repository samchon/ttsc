import type { JsxOpeningFragment } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxOpeningFragment}: the `<>` that opens a {@link JsxFragment}.
 *
 * It takes no arguments and carries no tag name or attributes; it is the empty
 * leading delimiter of a `<>...</>` pair. Pair it with a
 * {@link JsxClosingFragment} through {@link createJsxFragment}.
 *
 * With no inputs, the printer emits:
 *
 * ```tsx
 * <>
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link JsxOpeningFragment}.
 * @evidence contracts/common.md#principled-implementation
 *   The zero-field opening fragment denotes the fixed <> boundary without a
 *   tag name or attributes; the parent fragment supplies its children and closure.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A discriminant alone represents this delimiter, sharing the node pipeline
 *   without a speculative configuration or framework wrapper.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The fixed delimiter is JSX grammar, not a hardcoded consumer output or a
 *   patched element constructor with its name erased.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the empty delimiter, pairing constructor and absence of
 *   inputs, with a standalone opening example and documented return type.
 */
export const createJsxOpeningFragment = (): JsxOpeningFragment =>
  make("JsxOpeningFragment", {});
