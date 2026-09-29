import type { Identifier } from "../../ast";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Coerce a `string | Identifier` into an {@link Identifier}.
 *
 * Identifier inputs retain identity; string inputs use the shared identifier
 * constructor and remain literal name text. This helper does not validate
 * identifiers or allocate collision-free names, and does not rewrite selected
 * names to meet a downstream expected output.
 *
 * @internal
 */
export const asName = (name: string | Identifier): Identifier =>
  typeof name === "string" ? createIdentifier(name) : name;
