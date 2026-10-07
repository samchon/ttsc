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
 * @evidence contracts/common.md#principled-implementation
 *   Property-name normalization retains the member key. An omitted initializer
 *   leaves implicit enum evaluation to TypeScript instead of guessing its value.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The member owns only name and initializer; its enum parent owns sequencing.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Explicit initializer expressions are caller trees, not hardcoded ordinals.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes explicit and implicit values; the bare-member example
 *   omits declaration punctuation and tags follow separated prose paragraphs.
 */
export const createEnumMember = (
  name: string | PropertyName,
  initializer?: Expression,
): EnumMember =>
  make("EnumMember", { name: asPropertyName(name), initializer });
