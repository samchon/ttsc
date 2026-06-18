import type { PropertyName } from "../../ast";
import { createIdentifier } from "../names/createIdentifier";

/** @internal */
export const asPropertyName = (name: string | PropertyName): PropertyName =>
  typeof name === "string" ? createIdentifier(name) : name;
