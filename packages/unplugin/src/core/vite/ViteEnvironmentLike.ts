import type { ViteHotChannelLike } from "./ViteHotChannelLike";
import type { ViteModuleGraphLike } from "./ViteModuleGraphLike";
import type { ViteModuleNodeLike } from "./ViteModuleNodeLike";

/** One dev-server environment (client, ssr, or a custom one). */
export interface ViteEnvironmentLike {
  /** Channel to this environment's clients. */
  hot?: ViteHotChannelLike;
  /** This environment's module graph. */
  moduleGraph?: ViteModuleGraphLike;
  /**
   * Run Vite's own update propagation for one of this environment's modules
   * (Vite 6+), as an edit to its file would (samchon/ttsc#1393).
   */
  reloadModule?(node: ViteModuleNodeLike): Promise<void>;
}
