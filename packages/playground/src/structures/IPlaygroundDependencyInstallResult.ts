import type { IPlaygroundDependencyPackage } from "./IPlaygroundDependencyPackage";
import type { IPlaygroundInstalledDependency } from "./IPlaygroundInstalledDependency";

/**
 * Aggregate result returned by {@link installPlaygroundDependencies}.
 *
 * @evidence contracts/common.md#principled-implementation Exact identities describe the complete graph while downloaded package metadata and file maps describe this call's additions in each consumer's namespace.
 * @evidence contracts/common.md#clear-and-simple-design Compiler, editor and runtime maps remain explicit lanes instead of requiring consumers to infer path spelling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Output namespaces represent actual consumer protocols rather than special casing a package or source example.
 * @evidence contracts/common.md#meaningful-documentation Member prose distinguishes complete state from new downloads and documents each map's path namespace, with documentation-skill member spacing.
 */
export interface IPlaygroundDependencyInstallResult {
  /** Complete exact state after merging installed packages with this call. */
  resolvedDependencies: IPlaygroundInstalledDependency[];

  /** Packages whose tarballs were downloaded and unpacked by this call. */
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
