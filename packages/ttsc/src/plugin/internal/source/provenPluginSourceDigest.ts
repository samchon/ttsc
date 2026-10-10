import { PluginContentIdentities } from "./PluginContentIdentities";

/**
 * The `pluginSourceDigest` of a plugin source directory, proven from the
 * records of `projectRoot`'s plugin cache when the caller names its project.
 *
 * WARNING (#1725): a consumer that proves a reported plugin-source state in a
 * new process, such as a bundler worker, a capability host or the language
 * server, read every source byte again because its own memo starts empty. The
 * load that reported the state already recorded this digest
 * (`PluginContentIdentities`), so a process that names the same project reuses
 * it while the files' metadata still holds. Without a project, or when no store
 * can be opened, the bytes are read as before.
 *
 * @param directory The source directory.
 * @param projectRoot Project whose plugin cache root holds the records.
 * @param env Environment selecting that cache root; this process's by default.
 * @returns The digest, as lowercase hex.
 * @throws When a listed source file cannot be read, as `pluginSourceDigest`
 *   does.
 * @evidence contracts/common.md#principled-implementation The record store applies its separable-signature rule to exactly the files the digest reads; every unproved premise falls back to the content reader.
 * @evidence contracts/common.md#clear-and-simple-design Store opening and the population proof stay with PluginContentIdentities; this entry only names the project for consumers outside the loader.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No path, timestamp or process memo stands for content; the store refuses a root inside the source.
 * @evidence contracts/common.md#meaningful-documentation The paragraphs state the regression, the reuse premise and the fallback.
 * @evidence contracts/portability.md#os-neutral-implementation Cache-root selection and device-keyed references are delegated to the shared owners.
 * @evidence contracts/performance.md#efficient-algorithms A proven digest stats the selected files; an unproven one also reads their bytes once. Opening the store writes two reference probes.
 * @evidence contracts/performance.md#reuse-equivalent-work The digest the load recorded is reused across processes under the same project's store.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The store lives for this call; records belong to the cache root's single-file pruning.
 */
export function provenPluginSourceDigest(
  directory: string,
  projectRoot?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return PluginContentIdentities.sourceDirectory(
    projectRoot === undefined
      ? undefined
      : PluginContentIdentities.open({
          projectRoot,
          env,
          sources: [directory],
        }),
    directory,
  );
}
