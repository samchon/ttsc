export interface ITtscResolveOptions {
  /**
   * Override `require.resolve` for testing. Takes a module request string and
   * returns an absolute path (or throws).
   */
  resolver?: (request: string) => string;
  /** Override `process.platform` for testing. */
  platform?: NodeJS.Platform;
  /** Override `process.arch` for testing. */
  arch?: string;
  /** Override `process.env` for testing. */
  env?: NodeJS.ProcessEnv;
  /**
   * Override the package-local scan used for the local `native/ttsc-native`
   * fallback. Returns an absolute path if present, else null.
   */
  localBinaryLookup?: () => string | null;
  /** Override the module directory used to resolve the package-local binary. */
  moduleDir?: string;
}
