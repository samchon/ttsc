/** Separate lexical and physical identities for one selected project. */
export interface ITtscProjectIdentity {
  /** Caller working directory before filesystem canonicalization. */
  invocationCwd: string;
  /** Caller-selected config spelling before filesystem canonicalization. */
  logicalConfigPath: string;
  /** Directory containing the caller-selected config spelling. */
  logicalProjectRoot: string;
  /** Realpath-resolved config used to load the TypeScript Program. */
  physicalConfigPath: string;
  /** Realpath-resolved root supplied to the TypeScript Program host. */
  physicalProjectRoot: string;
  /** Caller-declared project-root override, when present. */
  explicitProjectRoot?: string;
  /** Caller-declared plugin-config discovery origin, when present. */
  pluginConfigOrigin?: string;
}
