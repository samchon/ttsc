import type { Identifier } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link Identifier}: a bare name reference.
 *
 * The `text` is stored verbatim as the identifier name, so the printer emits it
 * exactly as given. No validation or escaping is applied, the caller is
 * responsible for passing a valid identifier name.
 *
 * With `text` of `foo`, this prints:
 *
 * ```ts
 * foo;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The textual content.
 * @returns The created {@link Identifier}.
 */
export const createIdentifier = (text: string): Identifier =>
  make("Identifier", { text });
