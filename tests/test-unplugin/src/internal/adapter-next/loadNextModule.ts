import { TestUnpluginRuntime } from "@ttsc/testing";

import type { INextLikeConfig } from "./INextLikeConfig";

interface INextModule {
  default: (config?: INextLikeConfig, options?: unknown) => INextLikeConfig;
  TURBOPACK_PROJECT_WIDE_GLOB_COVERAGE: ReadonlyArray<
    readonly [string, readonly string[]]
  >;
}

/** Load the complete built `next` module, including its measured allowlist. */
export async function loadNextModule(): Promise<INextModule> {
  return (await import(TestUnpluginRuntime.libUrl("next"))) as INextModule;
}
