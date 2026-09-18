import type { ViteHotChannelLike } from "./ViteHotChannelLike";
import type { ViteModuleGraphLike } from "./ViteModuleGraphLike";

/** One dev-server environment (client, ssr, or a custom one). */
export interface ViteEnvironmentLike {
  /** Channel to this environment's clients. */
  hot?: ViteHotChannelLike;
  /** This environment's module graph. */
  moduleGraph?: ViteModuleGraphLike;
}
