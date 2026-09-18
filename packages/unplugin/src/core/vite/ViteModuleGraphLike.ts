import type { ViteModuleNodeLike } from "./ViteModuleNodeLike";

/**
 * The module-graph surface this module touches, shared by Vite's mixed module
 * graph and the per-environment graphs of the environment API.
 */
export interface ViteModuleGraphLike {
  fileToModulesMap?: Map<string, Set<ViteModuleNodeLike>>;
  getModulesByFile?(file: string): Set<ViteModuleNodeLike> | undefined;
  invalidateModule?(node: ViteModuleNodeLike): void;
}
