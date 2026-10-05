import * as nextModule from "../../../../../../packages/unplugin/src/next";
import type { INextLikeConfig } from "./INextLikeConfig";

interface INextModule {
  default: (config?: INextLikeConfig, options?: unknown) => INextLikeConfig;
  TURBOPACK_PROJECT_WIDE_GLOB_COVERAGE: ReadonlyArray<
    readonly [string, readonly string[]]
  >;
}

/** Load the complete authored `next` module, including its measured allowlist. */
export async function loadNextModule(): Promise<INextModule> {
  return nextModule as INextModule;
}
