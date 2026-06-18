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
 * Create a {@link BindingElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param dotDotDotToken The dotDotDotToken.
 * @param propertyName The propertyName.
 * @param name The name.
 * @param initializer The initializer.
 * @returns The created node.
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
