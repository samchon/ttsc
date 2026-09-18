import type { ViteHotChannelLike } from "./ViteHotChannelLike";
import type { ViteModuleGraphLike } from "./ViteModuleGraphLike";

/** One dev-server environment (client, ssr, or a custom one). */
export interface ViteEnvironmentLike {
  hot?: ViteHotChannelLike;
  moduleGraph?: ViteModuleGraphLike;
}
