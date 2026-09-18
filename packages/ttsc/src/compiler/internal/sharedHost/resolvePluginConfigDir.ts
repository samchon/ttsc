import path from "node:path";

/**
 * Resolve the caller-declared plugin config anchor to an absolute path, or
 * `undefined` when the caller did not declare one.
 *
 * The anchor exists for embedders that compile through a generated tsconfig
 * outside the project (the bundler adapters' alias overlay): they set
 * `pluginConfigDir` to the real project directory and every native plugin spawn
 * forwards it as `TTSC_PLUGIN_CONFIG_DIR`, so config-file discovery walks the
 * project instead of the wrapper's temp-dir ancestry. Callers that point at a
 * user-authored tsconfig (even a wrapper outside the project) leave it unset,
 * keeping discovery anchored at the tsconfig's own directory.
 */
export function resolvePluginConfigDir(options: {
  cwd?: string;
  pluginConfigDir?: string;
}): string | undefined {
  if (options.pluginConfigDir === undefined || options.pluginConfigDir === "") {
    return undefined;
  }
  return path.resolve(options.cwd ?? process.cwd(), options.pluginConfigDir);
}
