import type {
  BindingElement,
  BindingName,
  Expression,
  PropertyName,
  Token,
} from "../../ast";
import { asPropertyName } from "../internal/asPropertyName";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link BindingElement}: one entry of an array or object binding
 * pattern.
 *
 * A `dotDotDotToken` marks a rest element. A `propertyName` (accepted as a
 * string or {@link PropertyName}, normalized with {@link asPropertyName}) maps a
 * source property to a different local `name`. A string `name` is wrapped with
 * {@link createIdentifier}. An `initializer` supplies a default value.
 *
 * The printer renders the parts as `...`, `propertyName: name` and `= default`,
 * each present only when supplied. A plain element named `a` prints as `a`;
 * with an initializer `def` it prints as `a = def`; a rest element named `rest`
 * prints as `...rest`. With a property name `src` mapping to local `dst` it
 * prints:
 *
 * ```ts
 * src: dst;
 * ```
 *
 * Callers ensure rest, default and property mapping form a legal combination in
 * the enclosing pattern; the builder does not check those constraints.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param dotDotDotToken The rest token, if this is a rest element.
 * @param propertyName The source property name, if renamed.
 * @param name The local binding name.
 * @param initializer The default-value initializer, if any.
 * @returns The created {@link BindingElement}.
 * @evidence contracts/common.md#principled-implementation Optional source key and local BindingName stay distinct, strings normalize to names, and rest/default fields preserve supplied syntax; legal combinations remain caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design Shared name adapters and make perform normalization once while enclosing patterns own position and punctuation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts String normalization creates explicit name nodes rather than invented bindings or a guessed source-property mapping.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains source/local mapping, rest and defaults plus combination limits; examples and parameter descriptions are separated from tags.
 */
export const createBindingElement = (
  dotDotDotToken: Token | undefined,
  propertyName: string | PropertyName | undefined,
  name: string | BindingName,
  initializer?: Expression,
): BindingElement =>
  make("BindingElement", {
    dotDotDotToken,
    propertyName:
      propertyName === undefined ? undefined : asPropertyName(propertyName),
    name: typeof name === "string" ? createIdentifier(name) : name,
    initializer,
  });
