import type { Identifier } from "../../ast";
import { createIdentifier } from "./createIdentifier";

/**
 * Create a temporary variable name as a plain {@link Identifier}.
 *
 * The legacy compiler uses a stateful name generator that allocates a fresh,
 * collision-free identifier and records it via `recordTempVariable`. This
 * package is stateless, so this is a simplified placeholder: it does not track
 * or guarantee uniqueness, it just returns an identifier built from a fixed
 * `_temp` base with the optional `prefix` and `suffix` wrapped around it.
 *
 * The `recordTempVariable` and `reservedInNestedScopes` parameters belong to
 * the stateful generator and are accepted for signature parity but ignored. Two
 * calls with the same arguments produce the same name, so the caller must keep
 * names distinct.
 *
 * With no arguments, this prints:
 *
 * ```ts
 * _temp;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param _recordTempVariable Ignored; kept for signature parity.
 * @param _reservedInNestedScopes Ignored; kept for signature parity.
 * @param prefix An optional name prefix.
 * @param suffix An optional name suffix.
 * @returns The created {@link Identifier}.
 */
export const createTempVariable = (
  _recordTempVariable?: unknown,
  _reservedInNestedScopes?: boolean,
  prefix?: string,
  suffix?: string,
): Identifier => createIdentifier(`${prefix ?? ""}_temp${suffix ?? ""}`);
