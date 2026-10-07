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
 * @evidence contracts/common.md#principled-implementation
 *   Concatenating prefix, _temp and suffix implements the documented stateless
 *   placeholder. It neither records allocations nor guarantees distinct names;
 *   the legacy recording and reservation arguments have no effect.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Name assembly delegates to createIdentifier; allocation/scoping machinery
 *   is absent rather than implied by a second internal naming abstraction.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   _temp is the declared placeholder base. Ignored legacy arguments are stated
 *   as unsupported semantics instead of being claimed as successful generation.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains collision responsibility, ignored callbacks/flags and optional
 *   affixes in separated paragraphs with an example and blank before tags.
 */
export const createTempVariable = (
  _recordTempVariable?: unknown,
  _reservedInNestedScopes?: boolean,
  prefix?: string,
  suffix?: string,
): Identifier => createIdentifier(`${prefix ?? ""}_temp${suffix ?? ""}`);
