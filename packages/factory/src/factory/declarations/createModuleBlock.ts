import type { ModuleBlock, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ModuleBlock}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The statements.
 * @returns The created {@link ModuleBlock}.
 */
export const createModuleBlock = (
  statements: readonly Statement[],
): ModuleBlock => make("ModuleBlock", { statements });
