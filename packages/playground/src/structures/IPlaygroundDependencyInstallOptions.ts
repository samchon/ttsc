import type { IPlaygroundDependencyProgress } from "./IPlaygroundDependencyProgress";
import type { IPlaygroundInstalledDependency } from "./IPlaygroundInstalledDependency";

/** Options for {@link installPlaygroundDependencies}. */
export interface IPlaygroundDependencyInstallOptions {
  /** Defaults to `globalThis.fetch`. Override for tests or for offline runs. */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  /**
   * Exact package identities already mounted in this session.
   *
   * New edges are reconciled against their versions, registry targets, and
   * active requests before a tarball is reused.
   */
  installedDependencies?: Iterable<IPlaygroundInstalledDependency>;
  /**
   * Legacy name-only skip list.
   *
   * Prefer `installedDependencies`; names alone cannot validate later ranges.
   */
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
