import type { BindingElement } from "./BindingElement";
import type { OmittedExpression } from "./OmittedExpression";

/**
 * An element of an array binding pattern (or an elision).
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ArrayBindingElement = BindingElement | OmittedExpression;
