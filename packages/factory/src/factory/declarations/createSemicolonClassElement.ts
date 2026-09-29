import type { SemicolonClassElement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SemicolonClassElement}: a stray `;` in a class body.
 *
 * This is an empty class member, a lone semicolon that TypeScript permits
 * between real members. It carries no name or body. Placed inside a class, the
 * printer emits it as a single semicolon on its own line:
 *
 * ```ts
 * class C {
 *   ;
 * }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The zero-field SemicolonClassElement discriminant represents an empty
 *   class member; the printer emits its semicolon rather than a named property.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   No name/body fields are necessary; the enclosing class owns placement.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Empty props reflect the grammar's empty member, not suppressed real content.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the unnamed/bodyless member and its corrected class example,
 *   with descriptive prose and acknowledgments visibly separated.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link SemicolonClassElement}.
 */
export const createSemicolonClassElement = (): SemicolonClassElement =>
  make("SemicolonClassElement", {});
