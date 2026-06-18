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
 * class C {}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link SemicolonClassElement}.
 */
export const createSemicolonClassElement = (): SemicolonClassElement =>
  make("SemicolonClassElement", {});
