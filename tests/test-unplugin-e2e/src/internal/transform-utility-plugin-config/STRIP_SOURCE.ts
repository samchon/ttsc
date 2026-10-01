/**
 * Shared scenarios for utility-plugin config discovery through the generated
 * alias tsconfig.
 *
 * Any bundler alias makes `transformTtsc` compile through a generated tsconfig
 * in the system temp directory that `extends` the project one. These scenarios
 * pin that `@ttsc/strip` / `@ttsc/banner` config-file discovery and relative
 * `configFile` resolution still anchor at the real project (via the launcher's
 * `TTSC_PLUGIN_CONFIG_DIR` channel), not at the temp directory.
 */

/** Source whose `logger.trace` call is stripped only by the project config. */
export const STRIP_SOURCE = [
  "const logger = { trace(message: string): void { void message; } };",
  'logger.trace("drop");',
  'console.log("kept");',
  'export const value: string = "kept";',
  "",
].join("\n");
