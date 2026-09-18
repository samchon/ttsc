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
  /** Physical TypeScript root whose checked preparation created this manifest. */
  entrySource?: string;
  /** Exact JavaScript emitted for `entrySource`. */
  entryFile?: string;
  /**
   * The build's record of the JavaScript it emitted, relative to `emitDir` with
   * `/` separators. Ownership is decided against it, so every process of the
   * run agrees on what the build compiled without listing the directory.
   */
  outputs?: readonly string[];
  /**
   * The entry tsconfig's `module` and `target`, deciding emit CJS/ESM per file.
   * `target` is not decoration: an absent `module` makes tsgo derive the module
   * kind from it.
   */
  moduleOptions?: OwningModuleOptions;
  /** Root directory for per-dependency build output. */
  depCacheDir: string;
  /**
   * `false` when the run disabled transform plugins (`ttsx --no-plugins`). A
   * TypeScript root the program reaches outside every checked build is part of
   * the same run, so it is compiled under the same plugin policy as the entry.
   */
  plugins?: false;
}
