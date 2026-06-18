import type { PrivateIdentifier } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link PrivateIdentifier}: a class private name beginning with `#`.
 *
 * The `text` is the name content. The leading `#` is added automatically when
 * it is missing, so both `secret` and `#secret` yield the same node. The
 * printer emits the name with exactly one `#`.
 *
 * With `text` of `secret`, this prints:
 *
 * ```ts
 * #secret;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The textual content.
 * @returns The created {@link PrivateIdentifier}.
 */
export const createPrivateIdentifier = (text: string): PrivateIdentifier =>
  make("PrivateIdentifier", { text: text.startsWith("#") ? text : `#${text}` });
