import type { FilesystemPathIdentity } from "./FilesystemPathIdentity";

/**
 * A memoizing filesystem-identity resolver for one transaction.
 *
 * Create one with {@link createFilesystemPathIdentityContext} per unit of work
 * (one build, one watch refresh, one runtime question) and ask it every
 * question whose answers must agree. Each realpath and case probe is taken once
 * per context, so two answers from one context stay consistent even while the
 * disk changes underneath.
 */
export type FilesystemPathIdentityContext = {
  /**
   * Whether names directly inside `directory` are compared case-sensitively,
   * judged at its nearest existing ancestor.
   */
  caseSensitive(directory: string): boolean;

  /**
   * Whether `candidate` is `root` itself or lies beneath it, compared by
   * identity key so aliases (8.3 names, symlinked or junctioned directories,
   * case variants on a case-insensitive volume) agree.
   */
  isWithin(root: string, candidate: string): boolean;

  /** Resolve `location`, existing or not, to its identity. */
  resolve(location: string): FilesystemPathIdentity;
};
