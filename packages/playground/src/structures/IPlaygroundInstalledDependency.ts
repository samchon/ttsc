import type { IPlaygroundDependencyRequest } from "./IPlaygroundDependencyRequest";

/**
 * Exact identity and active constraints of one dependency already mounted.
 *
 * @evidence contracts/common.md#principled-implementation Mount name, registry name, exact version and active requests jointly represent the installed graph's compatibility witness.
 * @evidence contracts/common.md#clear-and-simple-design Identity and its selecting constraints remain one record while artifact contents belong to result maps.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit exact identities replace name-only guesses about whether later requests are satisfied.
 * @evidence contracts/common.md#meaningful-documentation Member comments distinguish exposed name, alias target, exact version and requests, with documentation-skill member spacing.
 */
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
