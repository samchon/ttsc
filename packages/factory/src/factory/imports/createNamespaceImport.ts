import type { Identifier, NamespaceImport } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link NamespaceImport}: the `* as ns` binding that imports an entire
 * module under a single namespace name.
 *
 * This node fills the `namedBindings` slot of an {@link ImportClause}. The
 * `name` accepts a raw string and is wrapped in an identifier for you.
 *
 * Given the namespace name `ns`, this prints:
 *
 * ```ts
 * * as ns
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @returns The created {@link NamespaceImport}.
 */
export const createNamespaceImport = (
  name: string | Identifier,
): NamespaceImport => make("NamespaceImport", { name: asName(name) });
