import type {
  Expression,
  ImportAttribute,
  ImportAttributeName,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ImportAttribute}: one `name: value` entry inside an
 * {@link ImportAttributes} clause.
 *
 * The `name` is an identifier or string literal key and the `value` is the
 * attribute expression, almost always a string literal. The printer separates
 * the two with `: `.
 *
 * Given a `"type"` name and a `"json"` string value, this prints:
 *
 * ```ts
 * "type": "json"
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The attribute name.
 * @param value The attribute value.
 * @returns The created {@link ImportAttribute}.
 */
export const createImportAttribute = (
  name: ImportAttributeName,
  value: Expression,
): ImportAttribute => make("ImportAttribute", { name, value });
