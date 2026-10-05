import path from "node:path";

/**
 * Resolve the caller-declared plugin config anchor to an absolute path, or
 * `undefined` when the caller did not declare one.
 *
 * The anchor exists for embedders that compile through a generated tsconfig
 * outside the project (the bundler adapters' alias overlay): they set
 * `pluginConfigDir` to the real project directory. Build and transform
 * environment composers use this result for `TTSC_PLUGIN_CONFIG_DIR`, with
 * their own caller-environment precedence. This resolver does not inspect that
 * environment or authenticate a config's physical ancestry. An absent anchor
 * returns undefined for the consumer's ordinary discovery policy.
 *
 * @evidence contracts/common.md#principled-implementation Only an explicit nonempty config anchor overrides discovery ancestry; path.resolve interprets a relative anchor from the declared cwd or current process directory.
 * @evidence contracts/common.md#clear-and-simple-design One resolver serves generated-wrapper consumers while preserving undefined as the ordinary tsconfig-owned discovery policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The anchor comes from caller authority, not a hardcoded consumer name or a guessed project directory beside a temporary wrapper.
 * @evidence contracts/common.md#meaningful-documentation Purpose and wrapper rationale explain both explicit and absent-anchor behavior in separate paragraphs following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation path.resolve performs native path anchoring; no slash replacement or OS-based case policy is used to turn the caller's spelling into identity.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This adapter delegates one native path-resolution operation and chooses no independent growing-workload algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Caller options and process cwd remain invocation inputs; this accessor coordinates no reusable computation across requests.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only an optional path string is returned; no filesystem handle, retained state or task is acquired.
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
