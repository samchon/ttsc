import type { IPlaygroundDependencyProgress } from "./IPlaygroundDependencyProgress";

/** Options for {@link installPlaygroundDependencies}. */
export interface IPlaygroundDependencyInstallOptions {
  /** Defaults to `globalThis.fetch`. Override for tests or for offline runs. */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  /** Package names the wasm already has — skip re-installing them. */
  installedPackages?: Iterable<string>;
  /** Package names to never install (preinstalled / built-in). */
  ignoredPackages?: Iterable<string>;
  /** Safety cap: error out after installing this many packages. */
  maxPackages?: number;
  /** Aborts the install when triggered. */
  signal?: AbortSignal;
  /** Fires for each phase transition during the install. */
  onProgress?: (event: IPlaygroundDependencyProgress) => void;
}
