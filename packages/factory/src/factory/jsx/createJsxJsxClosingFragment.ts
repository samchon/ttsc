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
 * @evidence contracts/common.md#principled-implementation
 *   JsxClosingFragment denotes the fixed </> boundary and uses the upstream
 *   factory's exact createJsxJsxClosingFragment name, without a tag name or a
 *   fabricated opening-element reference.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A zero-field delimiter is sufficient; the fragment parent owns children
 *   and pairing, so this constructor needs no duplicated state.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The fixed closing syntax is the node's grammar. The doubled Jsx in the
 *   public name follows the actual legacy API, not a local alias workaround.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies the closing delimiter and pairing constructor,
 *   with a standalone example and its returned node type documented.
 */
export const createJsxJsxClosingFragment = (): JsxClosingFragment =>
  make("JsxClosingFragment", {});
