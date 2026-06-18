import type { Identifier } from "../../ast";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Coerce a `string | Identifier` into an {@link Identifier}.
 *
 * @internal
 */
export const asName = (name: string | Identifier): Identifier =>
  typeof name === "string" ? createIdentifier(name) : name;
