import type { OwningModuleOptions } from "./OwningModuleOptions";

/**
 * Runtime manifest written by `runTtsx` (the parent) and read once here. It
 * describes the already-built entry project so the hooks can serve its emit.
 */
export interface RuntimeManifest {
  /** Project root of the entry's owning tsconfig. */
  projectRoot: string;
  /** Source-tree root the emit mirrors (tsgo strips this prefix). */
  rootDir: string;
  /** Directory holding the entry project's emitted JavaScript. */
  emitDir: string;
  /** Emitted file list from the entry build, for source→output matching. */
  emittedFiles?: readonly string[];
  /** Physical TypeScript root whose checked preparation created this manifest. */
  entrySource?: string;
  /** Exact JavaScript emitted for `entrySource`. */
  entryFile?: string;
  /**
   * The entry tsconfig's `module` and `target`, deciding emit CJS/ESM per file.
   * `target` is not decoration: an absent `module` makes tsgo derive the module
   * kind from it.
   */
  moduleOptions?: OwningModuleOptions;
  /** Root directory for per-dependency build output. */
  depCacheDir: string;
}
