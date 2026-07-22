import type { IPlaygroundDependencyRequest } from "./IPlaygroundDependencyRequest";

/** Exact identity and active constraints of one dependency already mounted. */
export interface IPlaygroundInstalledDependency {
  /** Exposed package name under `node_modules`. */
  name: string;
  /** Package name queried from the registry, which differs for npm aliases. */
  registryName: string;
  /** Exact mounted version. */
  version: string;
  /** Active requests that the mounted version satisfies. */
  requests: IPlaygroundDependencyRequest[];
}
