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
 * foo
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Identifier text is stored verbatim. Lexical validity is a caller premise,
 *   explicitly documented because no escaping can repair an arbitrary name.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One text field constructs the name; scope resolution stays outside this API.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Names come from the caller, without special-consumer renaming paths.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc warns that validation and escaping are absent, with the caller's
 *   responsibility and an example separated from the acknowledgment tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The textual content.
 * @returns The created {@link Identifier}.
 */
export const createIdentifier = (text: string): Identifier =>
  make("Identifier", { text });
