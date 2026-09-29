import type { PropertyName } from "../../ast";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Normalize the string shorthand for a property name to an identifier.
 *
 * Existing name nodes are retained, including literal and computed names. A
 * string is not parsed, quoted or validated as a property name; callers needing
 * another spelling supply its corresponding structured node. The conversion
 * introduces no name-specific replacements or mutable normalization cache.
 *
 * @internal
 */
export const asPropertyName = (name: string | PropertyName): PropertyName =>
  typeof name === "string" ? createIdentifier(name) : name;
