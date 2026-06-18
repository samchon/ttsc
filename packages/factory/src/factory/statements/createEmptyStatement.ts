import type { EmptyStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link EmptyStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link EmptyStatement}.
 */
export const createEmptyStatement = (): EmptyStatement =>
  make("EmptyStatement", {});
