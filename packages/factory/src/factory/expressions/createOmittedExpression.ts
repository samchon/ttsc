import type { OmittedExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link OmittedExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created node.
 */
export const createOmittedExpression = (): OmittedExpression =>
  make("OmittedExpression", {});
