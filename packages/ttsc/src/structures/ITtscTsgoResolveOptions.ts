export interface ITtscTsgoResolveOptions {
  /** Absolute path to an explicit tsgo-compatible binary. */
  binary?: string;
  /** Project directory used for node_modules resolution. */
  cwd?: string;
  /** Environment variables used for explicit binary overrides. */
  env?: NodeJS.ProcessEnv;
  /** Override process.platform for tests. */
  platform?: NodeJS.Platform;
  /** Override process.arch for tests. */
  arch?: string;
  /** Override package resolution for tests. */
  resolver?: (request: string) => string;
}
