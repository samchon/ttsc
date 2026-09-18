import type { ViteModuleNodeLike } from "./ViteModuleNodeLike";

/**
 * The module-graph surface this module touches, shared by Vite's mixed module
 * graph and the per-environment graphs of the environment API.
 */
export interface ViteModuleGraphLike {
  /**
   * Every file with its module nodes, scanned when the fast lookup misses a
   * spelling.
   */
  fileToModulesMap?: Map<string, Set<ViteModuleNodeLike>>;
  /** Fast exact lookup by slash-normalized file path. */
  getModulesByFile?(file: string): Set<ViteModuleNodeLike> | undefined;
  /** Drop a node's cached transform so the next request retransforms it. */
  invalidateModule?(node: ViteModuleNodeLike): void;
}
