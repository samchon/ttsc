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
 */
export const createJsxOpeningFragment = (): JsxOpeningFragment =>
  make("JsxOpeningFragment", {});
