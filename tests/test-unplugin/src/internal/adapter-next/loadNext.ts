import type { INextLikeConfig } from "./INextLikeConfig";
import { loadNextModule } from "./loadNextModule";

/** Load the built `next` adapter entry. */
export async function loadNext(): Promise<
  (config?: INextLikeConfig, options?: unknown) => INextLikeConfig
> {
  return (await loadNextModule()).default;
}
