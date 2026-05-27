import type { IPlaygroundDependencyPackage } from "./IPlaygroundDependencyPackage";

/** Aggregate result returned by {@link installPlaygroundDependencies}. */
export interface IPlaygroundDependencyInstallResult {
  packages: IPlaygroundDependencyPackage[];
  /**
   * `node_modules/...` keyed map of files to mount inside the wasm-side
   * compiler MemFS.
   */
  compilerFiles: Record<string, string>;
  /**
   * `file:///node_modules/...` keyed map of `.d.ts` + `package.json` files to
   * register with Monaco via `addExtraLib`.
   */
  editorLibs: Record<string, string>;
  /**
   * Package-rooted runtime files (e.g. `uuid/dist/index.js`) the in-page
   * execute sandbox `require` can resolve.
   */
  runtimeFiles: Record<string, string>;
}
