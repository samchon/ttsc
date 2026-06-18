import type { JsxClosingFragment } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxClosingFragment}: the `</>` that closes a
 * {@link JsxFragment}.
 *
 * It takes no arguments and is the empty trailing delimiter of a `<>...</>`
 * pair. Pair it with a {@link JsxOpeningFragment} through
 * {@link createJsxFragment}.
 *
 * With no inputs, the printer emits:
 *
 * ```tsx
 * </>
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link JsxClosingFragment}.
 */
export const createJsxJsxClosingFragment = (): JsxClosingFragment =>
  make("JsxClosingFragment", {});
