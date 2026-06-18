import type { EnumMember, Expression, PropertyName } from "../../ast";
import { asPropertyName } from "../internal/asPropertyName";
import { make } from "../internal/make";

/**
 * Create an {@link EnumMember}: a single member of an `enum` body.
 *
 * The `name` is the member key and accepts a string or property name. The
 * optional `initializer` assigns an explicit value; when present the printer
 * emits it after an `=`, and when omitted the member prints as the bare name
 * and TypeScript assigns the value implicitly.
 *
 * Given the name `Red` and a numeric initializer of `1`, the printed member is:
 *
 * ```ts
 * Red = 1;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @param initializer The initializer, if any.
 * @returns The created {@link EnumMember}.
 */
export const createEnumMember = (
  name: string | PropertyName,
  initializer?: Expression,
): EnumMember =>
  make("EnumMember", { name: asPropertyName(name), initializer });
