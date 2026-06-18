import type { Identifier } from "../../ast";
import { createIdentifier } from "./createIdentifier";

/**
 * Create a unique identifier name as a plain {@link Identifier}.
 *
 * The legacy compiler uses a stateful name generator that guarantees the
 * returned identifier is unique within its scope. This package is stateless, so
 * this is a simplified placeholder: it does not guarantee uniqueness, it just
 * returns the given `text` with the optional `prefix` and `suffix` wrapped
 * around it.
 *
 * The `flags` parameter belongs to the stateful generator and is accepted for
 * signature parity but ignored. Two calls with the same arguments produce the
 * same name, so the caller is responsible for avoiding collisions.
 *
 * With `text` of `base` and no prefix or suffix, this prints:
 *
 * ```ts
 * base;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The base name text.
 * @param _flags Ignored; kept for signature parity.
 * @param prefix An optional name prefix.
 * @param suffix An optional name suffix.
 * @returns The created {@link Identifier}.
 */
export const createUniqueName = (
  text: string,
  _flags?: number,
  prefix?: string,
  suffix?: string,
): Identifier => createIdentifier(`${prefix ?? ""}${text}${suffix ?? ""}`);
