import type { EnumMember, Expression, PropertyName } from "../../ast";
import { asPropertyName } from "../internal/asPropertyName";
import { make } from "../internal/make";

/**
 * Create a {@link EnumMember}.
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
