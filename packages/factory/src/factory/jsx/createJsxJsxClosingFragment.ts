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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link JsxClosingFragment}.
 */
export const createJsxJsxClosingFragment = (): JsxClosingFragment =>
  make("JsxClosingFragment", {});
